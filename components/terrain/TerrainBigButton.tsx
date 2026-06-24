'use client'

type Variant = 'primary' | 'secondary' | 'ghost' | 'success'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg ring-2 ring-emerald-300',
  secondary: 'bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-800',
  ghost: 'bg-transparent text-slate-500 hover:text-slate-700 underline text-sm font-semibold py-2',
}

type Props = {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: Variant
  type?: 'button' | 'submit'
  className?: string
}

export default function TerrainBigButton({
  children,
  onClick,
  disabled,
  loading,
  variant = 'primary',
  type = 'button',
  className = '',
}: Props) {
  const isGhost = variant === 'ghost'

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${
        isGhost
          ? VARIANTS.ghost
          : `rounded-2xl py-5 px-6 font-black text-lg ${VARIANTS[variant]}`
      } ${className}`}
    >
      {loading ? 'Patientez…' : children}
    </button>
  )
}
