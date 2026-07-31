const storageKey = 'project_admin_access_token'

let memoryToken: string | null = null

export const tokenStorage = {
  get() {
    return memoryToken ?? sessionStorage.getItem(storageKey)
  },
  set(token: string) {
    memoryToken = token
    sessionStorage.setItem(storageKey, token)
  },
  clear() {
    memoryToken = null
    sessionStorage.removeItem(storageKey)
  },
}
