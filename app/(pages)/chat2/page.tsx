"use client"

import { useState } from 'react'
import {Button} from "@/components/ui/button"; // Correct import for default export
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Laptop, Image, Plus, Bookmark, ChevronRight, Paperclip, Smile, Send } from 'lucide-react'

export default function Page() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const historyItems = [
    { icon: '🤡', text: 'Clown in Paris' },
    { icon: '🐈', text: 'Sphinx Storm' },
    { icon: '🎬', text: 'Movie debate' },
    { icon: '🦔', text: 'Hedgehog Chess' },
  ]

  const exampleCards = [
    { icon: <Laptop className="w-6 h-6" />, title: 'Make my email sound more professional', image: '/placeholder.svg?height=200&width=300' },
    { icon: <Paperclip className="w-6 h-6" />, title: 'Create a packing list for a trip', image: '/placeholder.svg?height=200&width=300' },
    { icon: <Image className="w-6 h-6" />, title: 'Imagine an image', image: '/placeholder.svg?height=200&width=300' },
  ]

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`bg-white w-64 p-4 flex flex-col ${sidebarOpen ? '' : 'hidden'} md:block`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Meta AI</h1>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="md:hidden">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button className="mb-2 justify-start">
          <Plus className="mr-2 h-4 w-4" /> New conversation
        </Button>
        <Button variant="outline" className="mb-4 justify-start">
          <Bookmark className="mr-2 h-4 w-4" /> Saved
        </Button>
        <div className="flex-grow overflow-auto">
          <h2 className="font-semibold mb-2">History</h2>
          {historyItems.map((item, index) => (
            <Button key={index} variant="ghost" className="w-full justify-start mb-1">
              <span className="mr-2">{item.icon}</span> {item.text}
            </Button>
          ))}
        </div>
        <div className="mt-auto text-xs text-gray-500">
          <p>Meta © 2024</p>
          <p>Privacy · Terms · AI Terms · Cookies</p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b p-4 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="mr-2 md:hidden">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Ask Meta AI anything</h1>
        </header>
        <main className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {exampleCards.map((card, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center mb-2">
                    {card.icon}
                    <h3 className="ml-2 font-semibold">{card.title}</h3>
                  </div>
                  <img src={card.image} alt={card.title} className="w-full h-32 object-cover rounded-md" />
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
        <footer className="bg-white border-t p-4">
          <div className="flex items-center">
            <Input className="flex-grow mr-2" placeholder="Ask Meta AI anything..." />
            <Button size="icon" variant="ghost">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost">
              <Smile className="h-4 w-4" />
            </Button>
            <Button size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}
