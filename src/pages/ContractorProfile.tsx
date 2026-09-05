import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useGetSubscription } from "@/hooks/useBilling"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { SubscriptionStatus } from "@/components/SubscriptionStatus"
import { 
  User, 
  Mail, 
  Building, 
  Star, 
  Upload, 
  Edit2, 
  Save, 
  X,
  Plus,
  Trash2,
  Crown
} from "lucide-react"

interface PortfolioItem {
  id: string
  title: string
  description: string
  imageUrl: string
}

export function ContractorProfile() {
  const { user } = useAuth()
  const { data: subscription } = useGetSubscription()
  const [isEditing, setIsEditing] = useState(false)
  const [bio, setBio] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")
  const [specialties, setSpecialties] = useState<string[]>([])
  const [newSpecialty, setNewSpecialty] = useState("")
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [newPortfolioItem, setNewPortfolioItem] = useState({ title: "", description: "", imageUrl: "" })

  if (!user) return null

  const isPro = subscription?.plan_tier === 'pro' || subscription?.plan_tier === 'enterprise'
  const isContractor = user.role === 'contractor'

  // Mock data for demonstration
  const rating = 4.8
  const reviewCount = 24
  const completedJobs = 47

  const handleAddSpecialty = () => {
    if (newSpecialty.trim() && !specialties.includes(newSpecialty.trim())) {
      setSpecialties([...specialties, newSpecialty.trim()])
      setNewSpecialty("")
    }
  }

  const handleRemoveSpecialty = (specialty: string) => {
    setSpecialties(specialties.filter(s => s !== specialty))
  }

  const handleAddPortfolioItem = () => {
    if (newPortfolioItem.title.trim() && newPortfolioItem.imageUrl.trim()) {
      setPortfolio([...portfolio, {
        id: Date.now().toString(),
        ...newPortfolioItem
      }])
      setNewPortfolioItem({ title: "", description: "", imageUrl: "" })
    }
  }

  const handleRemovePortfolioItem = (id: string) => {
    setPortfolio(portfolio.filter(item => item.id !== id))
  }

  const handleSave = () => {
    // TODO: Save profile to backend
    setIsEditing(false)
  }

  return (
    <div className="w-full max-w-7xl mx-auto py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Profile</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="capitalize">
              {user.role}
            </Badge>
            {isPro && (
              <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 flex items-center gap-1">
                <Crown className="h-3 w-3" />
                PRO Member
              </Badge>
            )}
          </div>
        </div>
        {isContractor && (
          <Button onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? (
              <>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </>
            ) : (
              <>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit Profile
              </>
            )}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Basic Info */}
        <div className="space-y-6">
          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Full Name</div>
                <div className="font-medium">{user.full_name}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Email
                </div>
                <div className="font-medium">{user.email}</div>
              </div>
              {user.company_name && (
                <div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building className="h-3 w-3" />
                    Company
                  </div>
                  <div className="font-medium">{user.company_name}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rating & Stats (for contractors) */}
          {isContractor && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Rating & Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold">{rating}</div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-5 w-5 ${
                          star <= Math.floor(rating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {reviewCount} reviews
                </div>
                <div className="pt-4 border-t">
                  <div className="text-sm text-muted-foreground">Completed Jobs</div>
                  <div className="text-2xl font-bold">{completedJobs}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Subscription Status */}
          <SubscriptionStatus />
        </div>

        {/* Middle Column - Bio & Specialties */}
        <div className="space-y-6">
          {/* Bio */}
          <Card>
            <CardHeader>
              <CardTitle>Bio</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell customers about yourself..."
                  rows={4}
                />
              ) : (
                <p className="text-muted-foreground">
                  {bio || "No bio added yet. Click Edit Profile to add one."}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Hourly Rate (for contractors) */}
          {isContractor && (
            <Card>
              <CardHeader>
                <CardTitle>Hourly Rate</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">$</span>
                    <Input
                      type="number"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      placeholder="0"
                      className="w-24"
                    />
                    <span className="text-muted-foreground">/hour</span>
                  </div>
                ) : (
                  <div className="text-2xl font-bold">
                    {hourlyRate ? `$${hourlyRate}/hour` : "Not set"}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Specialties */}
          {isContractor && (
            <Card>
              <CardHeader>
                <CardTitle>Specialties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {specialties.map((specialty) => (
                    <Badge key={specialty} variant="secondary" className="flex items-center gap-1">
                      {specialty}
                      {isEditing && (
                        <button
                          onClick={() => handleRemoveSpecialty(specialty)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                  {specialties.length === 0 && (
                    <span className="text-muted-foreground text-sm">No specialties added</span>
                  )}
                </div>
                {isEditing && (
                  <div className="flex gap-2">
                    <Input
                      value={newSpecialty}
                      onChange={(e) => setNewSpecialty(e.target.value)}
                      placeholder="Add specialty..."
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSpecialty()}
                    />
                    <Button size="sm" onClick={handleAddSpecialty}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Portfolio */}
        <div className="space-y-6">
          {isContractor && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Portfolio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {portfolio.length > 0 ? (
                  <div className="space-y-4">
                    {portfolio.map((item) => (
                      <div key={item.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="font-medium">{item.title}</div>
                          {isEditing && (
                            <button
                              onClick={() => handleRemovePortfolioItem(item.id)}
                              className="text-destructive hover:text-destructive/80"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        )}
                        <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                          <span className="text-muted-foreground text-sm">Image preview</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No portfolio items yet</p>
                )}

                {isEditing && (
                  <div className="border-t pt-4 space-y-3">
                    <Label>Add Portfolio Item</Label>
                    <Input
                      value={newPortfolioItem.title}
                      onChange={(e) => setNewPortfolioItem({ ...newPortfolioItem, title: e.target.value })}
                      placeholder="Title"
                    />
                    <Input
                      value={newPortfolioItem.description}
                      onChange={(e) => setNewPortfolioItem({ ...newPortfolioItem, description: e.target.value })}
                      placeholder="Description (optional)"
                    />
                    <Input
                      value={newPortfolioItem.imageUrl}
                      onChange={(e) => setNewPortfolioItem({ ...newPortfolioItem, imageUrl: e.target.value })}
                      placeholder="Image URL"
                    />
                    <Button size="sm" onClick={handleAddPortfolioItem} className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      Add to Portfolio
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Save Button */}
      {isEditing && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      )}
    </div>
  )
}
