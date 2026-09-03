import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useGetBid, useCreateBid, useUpdateBid } from "@/hooks/useBids"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency } from "@/lib/utils"
import type { CreateLineItemInput, LineItemType, BidLineItem } from "@/types"
import { Plus, Trash2, ArrowLeft, AlertCircle } from "lucide-react"

const lineItemTypes: { value: LineItemType; label: string }[] = [
  { value: "labor", label: "Labor" },
  { value: "material", label: "Material" },
  { value: "other", label: "Other" },
]

const units = ["hours", "units", "sqft", "linear ft", "each"]

interface ValidationErrors {
  title?: string
  customer_name?: string
  customer_email?: string
  lineItems?: string
  [key: string]: string | undefined
}

export function BidForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id
  
  const { data: existingBid, isLoading: isLoadingBid } = useGetBid(id || "")
  const createBid = useCreateBid()
  const updateBid = useUpdateBid()

  const [title, setTitle] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [jobAddress, setJobAddress] = useState("")
  const [taxRate, setTaxRate] = useState(0)
  const [notes, setNotes] = useState("")
  const [terms, setTerms] = useState("")
  const [lineItems, setLineItems] = useState<CreateLineItemInput[]>([
    { description: "", type: "labor", quantity: 1, unit: "hours", unitPrice: 0 }
  ])
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (existingBid) {
      setTitle(existingBid.title)
      setCustomerName(existingBid.customer_name || "")
      setCustomerEmail(existingBid.customer_email || "")
      setCustomerPhone(existingBid.customer_phone || "")
      setJobAddress(existingBid.job_address || "")
      setTaxRate(existingBid.tax_rate * 100) // Convert to percentage for display
      setNotes(existingBid.description || "")
      setTerms("")
      setLineItems(
        existingBid.line_items?.map((item: BidLineItem) => ({
          description: item.description,
          type: "labor" as LineItemType,
          quantity: item.quantity,
          unit: "hours",
          unitPrice: item.unit_price,
        })) || []
      )
    }
  }, [existingBid])

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", type: "labor", quantity: 1, unit: "hours", unitPrice: 0 }])
  }

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index))
    }
  }

  const updateLineItem = (index: number, field: keyof CreateLineItemInput, value: string | number) => {
    const updated = [...lineItems]
    updated[index] = { ...updated[index], [field]: value }
    setLineItems(updated)
    // Clear line item errors when user types
    if (errors.lineItems) {
      setErrors(prev => ({ ...prev, lineItems: undefined }))
    }
  }

  const calculateLineItemTotal = (item: CreateLineItemInput) => {
    return item.quantity * item.unitPrice
  }

  const subtotal = lineItems.reduce((sum, item) => sum + calculateLineItemTotal(item), 0)
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}

    if (!title.trim()) {
      newErrors.title = "Bid title is required"
    }

    if (!customerName.trim()) {
      newErrors.customer_name = "Customer name is required"
    }

    if (!customerEmail.trim()) {
      newErrors.customer_email = "Customer email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      newErrors.customer_email = "Please enter a valid email address"
    }

    if (lineItems.length === 0) {
      newErrors.lineItems = "At least one line item is required"
    } else {
      const hasEmptyDescription = lineItems.some(item => !item.description.trim())
      const hasInvalidQuantity = lineItems.some(item => item.quantity <= 0)
      const hasInvalidPrice = lineItems.some(item => item.unitPrice <= 0)

      if (hasEmptyDescription) {
        newErrors.lineItems = "All line items must have a description"
      } else if (hasInvalidQuantity) {
        newErrors.lineItems = "All quantities must be greater than 0"
      } else if (hasInvalidPrice) {
        newErrors.lineItems = "All unit prices must be greater than 0"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!validateForm()) {
      return
    }

    const input = {
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone || undefined,
      job_address: jobAddress || undefined,
      title,
      description: notes || undefined,
      taxRate,
      lineItems,
    }

    try {
      if (isEditMode) {
        await updateBid.mutateAsync({ id, ...input })
      } else {
        await createBid.mutateAsync(input)
      }
      navigate("/dashboard/bids")
    } catch (error: any) {
      console.error("Failed to save bid:", error)
      setSubmitError(error.response?.data?.error || error.message || "Failed to save bid. Please try again.")
    }
  }

  if (isEditMode && isLoadingBid) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <div className="text-muted-foreground">Loading bid...</div>
        </CardContent>
      </Card>
    )
  }

  const isPending = createBid.isPending || updateBid.isPending

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/bids")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle>{isEditMode ? "Edit Bid" : "Create New Bid"}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {submitError && (
            <div className="flex items-center gap-2 p-4 text-sm text-destructive bg-destructive/10 rounded-md">
              <AlertCircle className="h-4 w-4" />
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bid Title *</label>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (errors.title) setErrors(prev => ({ ...prev, title: undefined }))
                }}
                placeholder="e.g., Kitchen Remodel Estimate"
                className={errors.title ? "border-destructive" : ""}
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer Name *</label>
              <Input
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value)
                  if (errors.customer_name) setErrors(prev => ({ ...prev, customer_name: undefined }))
                }}
                placeholder="John Smith"
                className={errors.customer_name ? "border-destructive" : ""}
              />
              {errors.customer_name && (
                <p className="text-sm text-destructive">{errors.customer_name}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer Email *</label>
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => {
                  setCustomerEmail(e.target.value)
                  if (errors.customer_email) setErrors(prev => ({ ...prev, customer_email: undefined }))
                }}
                placeholder="john@example.com"
                className={errors.customer_email ? "border-destructive" : ""}
              />
              {errors.customer_email && (
                <p className="text-sm text-destructive">{errors.customer_email}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Customer Phone</label>
              <Input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Job Address</label>
            <Input
              value={jobAddress}
              onChange={(e) => setJobAddress(e.target.value)}
              placeholder="123 Main St, City, State ZIP"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tax Rate (%)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Line Items *</label>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
            
            {errors.lineItems && (
              <p className="text-sm text-destructive">{errors.lineItems}</p>
            )}
            
            <div className="space-y-4">
              {lineItems.map((item, index) => (
                <div key={index} className="grid grid-cols-2 md:grid-cols-12 gap-3 md:gap-2 items-end p-4 border rounded-lg">
                  <div className="col-span-2 md:col-span-4 space-y-2">
                    <label className="text-xs text-muted-foreground">Description</label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateLineItem(index, "description", e.target.value)}
                      placeholder="Item description"
                    />
                  </div>
                  
                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <label className="text-xs text-muted-foreground">Type</label>
                    <Select
                      value={item.type}
                      onChange={(e) => updateLineItem(index, "type", e.target.value as LineItemType)}
                    >
                      {lineItemTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  
                  <div className="col-span-1 md:col-span-1 space-y-2">
                    <label className="text-xs text-muted-foreground">Qty</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <label className="text-xs text-muted-foreground">Unit</label>
                    <Select
                      value={item.unit}
                      onChange={(e) => updateLineItem(index, "unit", e.target.value)}
                    >
                      {units.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </Select>
                  </div>
                  
                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <label className="text-xs text-muted-foreground">Unit Price</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div className="col-span-2 md:col-span-1 flex items-center justify-end gap-2">
                    <span className="text-sm font-medium">
                      {formatCurrency(calculateLineItemTotal(item))}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLineItem(index)}
                      disabled={lineItems.length === 1}
                      className="min-h-[44px] min-w-[44px]"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Internal)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes about this bid..."
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Terms & Conditions</label>
              <Textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Terms shown to customer..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end space-y-2">
            <div className="w-full sm:w-64 space-y-2 text-right">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({taxRate}%):</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/dashboard/bids")} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? "Saving..." : isEditMode ? "Update Bid" : "Create Bid"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
