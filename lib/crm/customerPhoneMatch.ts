export type CustomerPhoneRecord = {
    id: string
    nombreComercial: string
    contactoNombre: string | null
    contactoTelefono: string | null
    direccion: string | null
    zona: string | null
    localidad: string | null
}

export type CustomerPhoneMatch = CustomerPhoneRecord & {
    matchQuality: 'EXACT' | 'NATIONAL'
}

export function phoneDigits(value: string | null | undefined) {
    return String(value || '').replace(/\D/g, '')
}

function comparableDigits(value: string | null | undefined) {
    const digits = phoneDigits(value)
    return digits.startsWith('00') ? digits.slice(2) : digits
}

export function argentineNationalNumber(value: string | null | undefined) {
    let digits = comparableDigits(value)
    if (digits.startsWith('54')) digits = digits.slice(2)
    if (digits.length === 11 && digits.startsWith('9')) digits = digits.slice(1)
    while (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1)
    return digits.length === 10 ? digits : ''
}

export function matchCustomersByPhone(
    phoneE164: string,
    customers: CustomerPhoneRecord[],
): CustomerPhoneMatch[] {
    const targetDigits = comparableDigits(phoneE164)
    const targetNational = argentineNationalNumber(phoneE164)
    if (targetDigits.length < 8) return []

    return customers.flatMap<CustomerPhoneMatch>((customer): CustomerPhoneMatch[] => {
        const customerDigits = comparableDigits(customer.contactoTelefono)
        if (!customerDigits) return []
        if (customerDigits === targetDigits) {
            return [{ ...customer, matchQuality: 'EXACT' as const }]
        }

        const customerNational = argentineNationalNumber(customer.contactoTelefono)
        if (targetNational && customerNational === targetNational) {
            return [{ ...customer, matchQuality: 'NATIONAL' as const }]
        }
        return []
    }).sort((left, right) => {
        if (left.matchQuality !== right.matchQuality) return left.matchQuality === 'EXACT' ? -1 : 1
        return left.nombreComercial.localeCompare(right.nombreComercial, 'es')
    })
}
