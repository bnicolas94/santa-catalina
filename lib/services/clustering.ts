/**
 * K-Means Geographic Clustering Service
 * Groups delivery points into N clusters based on lat/lng proximity
 */

export interface GeoPoint {
    id: string       // pedidoId
    lat: number
    lng: number
    clienteId: string
    clienteNombre?: string
}

export interface Cluster {
    centroid: { lat: number; lng: number }
    points: GeoPoint[]
}

/**
 * K-Means clustering for geographic coordinates
 * @param points - Array of geo points to cluster
 * @param k - Number of clusters (= number of drivers)
 * @param maxIterations - Max iterations for convergence
 * @param maxPerCluster - Optional max points per cluster
 */
export function kMeansClustering(
    points: GeoPoint[],
    k: number,
    maxIterations: number = 50,
    maxPerCluster?: number
): Cluster[] {
    if (points.length === 0) return []
    if (k <= 0) return [{ centroid: { lat: 0, lng: 0 }, points }]
    if (k >= points.length) {
        // Each point gets its own cluster
        return points.map(p => ({
            centroid: { lat: p.lat, lng: p.lng },
            points: [p]
        }))
    }

    // Initialize centroids using k-means++ for better starting positions
    const centroids = initializeCentroidsKMeansPlusPlus(points, k)

    let clusters: Cluster[] = []

    // Calculate equitative max: ensures balanced distribution across clusters
    const equitativeMax = Math.ceil(points.length / k)
    // Use the smaller of: user-defined max OR equitative max
    const effectiveMax = maxPerCluster 
        ? Math.min(maxPerCluster, equitativeMax) 
        : equitativeMax

    for (let iter = 0; iter < maxIterations; iter++) {
        // Assignment step: assign each point to nearest centroid
        clusters = centroids.map(c => ({ centroid: { ...c }, points: [] as GeoPoint[] }))

        // Always use balanced assignment for equitative distribution
        assignBalanced(points, clusters, effectiveMax)

        // Update step: recalculate centroids
        let converged = true
        for (let i = 0; i < clusters.length; i++) {
            if (clusters[i].points.length === 0) continue

            const newLat = clusters[i].points.reduce((sum, p) => sum + p.lat, 0) / clusters[i].points.length
            const newLng = clusters[i].points.reduce((sum, p) => sum + p.lng, 0) / clusters[i].points.length

            // Check convergence (threshold: ~11 meters)
            if (Math.abs(newLat - centroids[i].lat) > 0.0001 || Math.abs(newLng - centroids[i].lng) > 0.0001) {
                converged = false
            }
            centroids[i] = { lat: newLat, lng: newLng }
            clusters[i].centroid = { lat: newLat, lng: newLng }
        }

        if (converged) break
    }

    // Remove empty clusters
    return clusters.filter(c => c.points.length > 0)
}

/**
 * Balanced assignment: assigns points to nearest cluster but respects maxPerCluster
 * Uses a greedy approach: for each point sorted by distance to nearest centroid,
 * assign to the nearest cluster that hasn't hit its limit
 */
function assignBalanced(points: GeoPoint[], clusters: Cluster[], maxPerCluster: number) {
    // Calculate distances from each point to each centroid
    const assignments: { pointIdx: number; clusterIdx: number; dist: number }[] = []

    for (let pi = 0; pi < points.length; pi++) {
        for (let ci = 0; ci < clusters.length; ci++) {
            const dist = haversineDistance(
                points[pi].lat, points[pi].lng,
                clusters[ci].centroid.lat, clusters[ci].centroid.lng
            )
            assignments.push({ pointIdx: pi, clusterIdx: ci, dist })
        }
    }

    // Sort by distance (shortest first)
    assignments.sort((a, b) => a.dist - b.dist)

    const assigned = new Set<number>()
    const clusterCounts = new Map<number, number>()

    for (const { pointIdx, clusterIdx } of assignments) {
        if (assigned.has(pointIdx)) continue
        const currentCount = clusterCounts.get(clusterIdx) || 0
        if (currentCount >= maxPerCluster) continue

        clusters[clusterIdx].points.push(points[pointIdx])
        clusterCounts.set(clusterIdx, currentCount + 1)
        assigned.add(pointIdx)
    }

    // Any remaining unassigned points go to the cluster with fewest points
    for (let pi = 0; pi < points.length; pi++) {
        if (assigned.has(pi)) continue
        let minCount = Infinity
        let bestCluster = 0
        for (let ci = 0; ci < clusters.length; ci++) {
            if (clusters[ci].points.length < minCount) {
                minCount = clusters[ci].points.length
                bestCluster = ci
            }
        }
        clusters[bestCluster].points.push(points[pi])
        assigned.add(pi)
    }
}

/**
 * K-Means++ initialization for better centroid starting positions
 */
function initializeCentroidsKMeansPlusPlus(
    points: GeoPoint[],
    k: number
): { lat: number; lng: number }[] {
    const centroids: { lat: number; lng: number }[] = []

    // First centroid: random point
    const firstIdx = Math.floor(Math.random() * points.length)
    centroids.push({ lat: points[firstIdx].lat, lng: points[firstIdx].lng })

    // Remaining centroids: weighted probability by distance to nearest centroid
    for (let c = 1; c < k; c++) {
        const distances = points.map(p => {
            let minDist = Infinity
            for (const centroid of centroids) {
                const dist = haversineDistance(p.lat, p.lng, centroid.lat, centroid.lng)
                if (dist < minDist) minDist = dist
            }
            return minDist * minDist // Square for weighted probability
        })

        const totalDist = distances.reduce((sum, d) => sum + d, 0)
        let threshold = Math.random() * totalDist
        let selectedIdx = 0

        for (let i = 0; i < distances.length; i++) {
            threshold -= distances[i]
            if (threshold <= 0) {
                selectedIdx = i
                break
            }
        }

        centroids.push({ lat: points[selectedIdx].lat, lng: points[selectedIdx].lng })
    }

    return centroids
}

/**
 * Haversine distance between two lat/lng points in kilometers
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371 // Earth radius in km
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

function toRad(deg: number): number {
    return deg * Math.PI / 180
}
