import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

type BaseProps = {
  label: string
  error?: string
  children?: ReactNode
}

type InputProps = BaseProps & InputHTMLAttributes<HTMLInputElement>
type TextAreaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>

export function TextField({ label, error, children, ...props }: InputProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} aria-invalid={Boolean(error)} />
      {children}
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  )
}

export function TextAreaField({ label, error, children, ...props }: TextAreaProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea {...props} aria-invalid={Boolean(error)} />
      {children}
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  )
}

export function SelectField({
  label,
  error,
  children,
  value,
  onChange,
}: BaseProps & {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  )
}
