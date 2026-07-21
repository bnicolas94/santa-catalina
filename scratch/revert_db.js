const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const taskDir = 'C:\\Users\\sandw\\.gemini\\antigravity\\brain\\9aa72407-8f2a-4c39-a291-f99d22e0c2e4\\.system_generated\\tasks';

async function revert() {
    const diffsToRevert = {}; // id -> diff to subtract from montoHorasExtras
    const originalHours = {}; // id -> original horasExtras

    // Parse task-3735 for montoHorasExtras
    try {
        const log3735 = fs.readFileSync(path.join(taskDir, 'task-3735.log'), 'utf8');
        const regex3735 = /Fixing Liquidacion ([a-f0-9\-]+) for Employee [a-f0-9\-]+\. Diff: ([\d\.]+)/g;
        let match;
        while ((match = regex3735.exec(log3735)) !== null) {
            diffsToRevert[match[1]] = parseFloat(match[2]);
        }
    } catch (e) {
        console.log('Error reading task-3735.log', e.message);
    }

    // Function to parse hours logs in chronological order to keep the FIRST 'Old hours'
    function parseHoursLog(filename) {
        try {
            const logContent = fs.readFileSync(path.join(taskDir, filename), 'utf8');
            // Regex handles two formats:
            // Fixing Liquidacion [ID] for Employee [Name]. Old hours: [val], New hours: [val]
            // Fixing Liquidacion [ID]. Old hours: [val], New hours: [val]
            const regex = /Fixing Liquidacion ([a-f0-9\-]+)(?: for Employee [^\.]+)?\. Old hours: ([\d\.]+), New hours: /g;
            let match;
            while ((match = regex.exec(logContent)) !== null) {
                const id = match[1];
                const oldHours = parseFloat(match[2]);
                if (!(id in originalHours)) {
                    originalHours[id] = oldHours;
                }
            }
        } catch (e) {
            console.log(`Error reading ${filename}`, e.message);
        }
    }

    // Parse in chronological order
    ['task-3791.log', 'task-3801.log', 'task-3839.log', 'task-3930.log'].forEach(parseHoursLog);

    let revertedCount = 0;

    // Get all records that might need reverting
    const idsToRevert = new Set([...Object.keys(diffsToRevert), ...Object.keys(originalHours)]);

    for (const id of idsToRevert) {
        const liq = await prisma.liquidacionSueldo.findUnique({ where: { id } });
        if (!liq) continue;

        const dataToUpdate = {};
        if (id in diffsToRevert) {
            dataToUpdate.montoHorasExtras = (liq.montoHorasExtras || 0) - diffsToRevert[id];
        }
        if (id in originalHours) {
            dataToUpdate.horasExtras = originalHours[id];
        }

        if (Object.keys(dataToUpdate).length > 0) {
            console.log(`Reverting ${id}:`, dataToUpdate);
            await prisma.liquidacionSueldo.update({
                where: { id },
                data: dataToUpdate
            });
            revertedCount++;
        }
    }

    console.log(`Reverted ${revertedCount} records.`);
    await prisma.$disconnect();
}

revert().catch(console.error);
