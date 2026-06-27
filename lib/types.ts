export interface Person {
  id: string
  name: string
  phone: string
}

export interface Group {
  id: string
  name: string
  people: Person[]
}

export interface ReceiptItem {
  id: string
  name: string
  price: number
  assignedTo: string[]
}

export interface Receipt {
  restaurantName: string | null
  items: ReceiptItem[]
  subtotal: number
  tax: number
  tip: number
  total: number
}
