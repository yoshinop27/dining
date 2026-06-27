import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const image = formData.get('image') as File

  const bytes = await image.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = (image.type || 'image/jpeg') as
    | 'image/jpeg'
    | 'image/png'
    | 'image/webp'
    | 'image/gif'

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Parse this restaurant receipt. Return ONLY a JSON object:
{
  "restaurantName": "string or null",
  "items": [{"id": "1", "name": "item name", "price": 12.99}],
  "subtotal": 0.00,
  "tax": 0.00,
  "tip": 0.00,
  "total": 0.00
}
Only include food/drink line items, not subtotal/tax/tip/total rows. Prices are positive numbers in dollars.`,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const match = text.match(/\{[\s\S]*\}/)
  const data = JSON.parse(match ? match[0] : text)

  data.items = (data.items ?? []).map((item: Record<string, unknown>, i: number) => ({
    ...item,
    id: item.id ?? String(i + 1),
    assignedTo: [],
  }))

  return Response.json(data)
}
