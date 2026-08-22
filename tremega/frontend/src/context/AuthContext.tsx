import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import api from "@/lib/api"

interface User {
  id: string
  email: string
  full_name: string
  role: string
  company_name?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, full_name: string, role: string, company_name?: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load user from token on app start
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      api.get("/auth/me")
        .then(({ data }) => {
          setUser(data)
        })
        .catch(() => {
          localStorage.removeItem("token")
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password })
    localStorage.setItem("token", data.token)
    setUser({
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      role: data.role,
    })
  }

  const register = async (email: string, password: string, full_name: string, role: string, company_name?: string) => {
    const { data } = await api.post("/auth/register", {
      email,
      password,
      full_name,
      role,
      company_name,
    })
    localStorage.setItem("token", data.token)
    setUser({
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      role: data.role,
    })
  }

  const logout = () => {
    localStorage.removeItem("token")
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
