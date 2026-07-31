export function formatDate(value: string | null) {
  if (!value) {
    return 'Not verified'
  }

  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}
