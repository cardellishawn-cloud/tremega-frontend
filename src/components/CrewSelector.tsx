import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Users, Plus, X, DollarSign } from 'lucide-react'
import { useState } from 'react'

interface CrewMember {
  id: string
  name: string
  role: string
  rate: number
}

interface CrewSelectorProps {
  selectedCrew: CrewMember[]
  onCrewChange: (crew: CrewMember[]) => void
}

export function CrewSelector({ selectedCrew, onCrewChange }: CrewSelectorProps) {
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newRate, setNewRate] = useState('')

  const totalLaborCost = selectedCrew.reduce((sum, member) => sum + member.rate * 8, 0)

  const handleAddCrew = () => {
    if (newName.trim()) {
      const newMember: CrewMember = {
        id: Date.now().toString(),
        name: newName.trim(),
        role: newRole.trim() || 'Worker',
        rate: parseFloat(newRate) || 35,
      }
      onCrewChange([...selectedCrew, newMember])
      setNewName('')
      setNewRole('')
      setNewRate('')
    }
  }

  const handleRemoveCrew = (id: string) => {
    onCrewChange(selectedCrew.filter((m) => m.id !== id))
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Card className="border-l-4 border-l-blue-600">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <span>Crew Information</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Crew Form */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Input
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
          />
          <Input
            placeholder="Role"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
          />
          <Input
            placeholder="Rate ($/hr)"
            type="number"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
          />
          <Button onClick={handleAddCrew} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>

        {/* Selected Crew */}
        <AnimatePresence>
          {selectedCrew.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedCrew.map((member, index) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                    className="relative bg-white border-2 border-blue-200 rounded-xl p-4 cursor-pointer hover:border-blue-400 transition-colors"
                  >
                    <button
                      onClick={() => handleRemoveCrew(member.id)}
                      className="absolute top-2 right-2 p-1 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                        {getInitials(member.name)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">{member.name}</div>
                        <div className="text-sm text-gray-500">{member.role}</div>
                        <div className="text-sm text-blue-600 font-medium">${member.rate}/hr</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Summary */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-wrap items-center justify-between bg-blue-50 rounded-lg p-4"
              >
                <div className="flex items-center gap-4">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    <Users className="mr-1 h-3 w-3" />
                    Total Crew: {selectedCrew.length}
                  </Badge>
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    <DollarSign className="mr-1 h-3 w-3" />
                    Est. Labor: ${totalLaborCost.toLocaleString()}
                  </Badge>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {selectedCrew.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No crew members added yet</p>
            <p className="text-sm">Add crew members to track labor</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default CrewSelector
