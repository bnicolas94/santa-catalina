'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import styles from './login.module.css'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const result = await signIn('credentials', {
                redirect: false,
                email,
                password,
            })

            if (result?.error) {
                setError('Email o contraseña incorrectos')
            } else {
                router.push('/')
                router.refresh()
            }
        } catch {
            setError('Error de conexión. Intentá de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.loginPage}>
            <div className={styles.loginCard}>
                <div className={styles.logoSection}>
                    <Image
                        src="/images/logo.png"
                        alt="Santa Catalina"
                        width={120}
                        height={120}
                        className={styles.logo}
                        priority
                    />
                    <h1 className={styles.title}>SANTA CATALINA</h1>
                    <p className={styles.subtitle}>Sistema de Gestión Industrial</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {error && (
                        <div className={styles.errorAlert}>
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="email" className="form-label">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            className="form-input"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password" className="form-label">
                            Contraseña
                        </label>
                        <input
                            id="password"
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className={`btn btn-primary ${styles.loginBtn}`}
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="spinner" style={{ width: 20, height: 20 }} />
                        ) : (
                            'Ingresar'
                        )}
                    </button>
                </form>
            </div>

            <p className={styles.footer}>
                Sandwichería & Distribuidora Santa Catalina © 2026
            </p>
        </div>
    )
}
