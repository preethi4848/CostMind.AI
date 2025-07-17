"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, Send, CheckCircle, AlertCircle, Sparkles, TrendingDown, Clock, Cloud, User, Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { usePathname } from "next/navigation" // Import usePathname
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface ApiResponse {
  response?: string
  message?: string
  content?: string
  text?: string
  error?: string
  status?: string
  data?: any
  choices?: Array<{
    message?: {
      content?: string
      text?: string
    }
  }>
}

type StatusType = "idle" | "loading" | "success" | "error"

const formatResponse = (rawResponse: string): string => {
  const formatted = rawResponse
    // Replace [Your Name] with Preethi
    .replace(/\[Your Name\]/g, "Preethi")
    // Clean up triple dashes
    .replace(/---+/g, "")
    // Convert HTML strong tags to markdown
    .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
    // Clean up extra whitespace
    .replace(/\n{3,}/g, "\n\n")
    // Remove leading/trailing whitespace
    .trim()

  return formatted
}

const parseMarkdownToJSX = (text: string) => {
  const lines = text.split("\n")
  const elements: React.ReactNode[] = []
  const currentIndex = 0

  lines.forEach((line, index) => {
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      elements.push(<br key={`br-${index}`} />)
      return
    }

    // Handle headers
    if (trimmedLine.startsWith("### ")) {
      elements.push(
        <h3 key={index} className="text-xl font-bold text-white mt-6 mb-3 border-b-2 border-blue-700 pb-2">
          {trimmedLine.replace("### ", "")}
        </h3>,
      )
    } else if (trimmedLine.startsWith("#### ")) {
      elements.push(
        <h4 key={index} className="text-lg font-semibold text-blue-400 mt-4 mb-2">
          {trimmedLine.replace("#### ", "")}
        </h4>,
      )
    } else if (trimmedLine.startsWith("- ")) {
      // Handle list items
      const content = trimmedLine.replace("- ", "")
      const formattedContent = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      elements.push(
        <li
          key={index}
          className="ml-4 mb-2 text-gray-300 list-disc"
          dangerouslySetInnerHTML={{ __html: formattedContent }}
        />,
      )
    } else {
      // Handle regular paragraphs
      const formattedLine = trimmedLine.replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="font-semibold text-white">$1</strong>',
      )
      elements.push(
        <p
          key={index}
          className="mb-3 text-gray-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formattedLine }}
        />,
      )
    }
  })

  return elements
}

export default function AICostOptimizerPage() {
  const [input, setInput] = useState("")
  const [response, setResponse] = useState("")
  const [status, setStatus] = useState<StatusType>("idle")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pathname = usePathname() // Get current path

  const resetStatus = useCallback(() => {
    setError("")
    setStatus("idle")
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!input.trim()) {
      setError("Please enter your AI task or cost question")
      setStatus("error")
      return
    }

    setIsSubmitting(true)
    setStatus("loading")
    setError("")
    setResponse("")

    try {
      // Call our own API route, which proxies to Lyzr Studio
      const apiResponse = await fetch("/api/optimizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input.trim() }),
      })

      if (!apiResponse.ok) {
        // Our API route will return a structured JSON error
        const errorData = await apiResponse
          .json()
          .catch(() => ({ error: "Unknown API error occurred. Could not parse error response." }))
        const errorMessage = errorData.error || `API Error: ${apiResponse.status} - ${apiResponse.statusText}`
        throw new Error(errorMessage)
      }

      const data = await apiResponse.json()
      console.log("Client received API Response:", data) // Debug log

      // Handle different possible response formats
      let responseText = ""

      if (typeof data === "string") {
        responseText = data
      } else if (data.response) {
        responseText = data.response
      } else if (data.message) {
        responseText = data.message
      } else if (data.content) {
        responseText = data.content
      } else if (data.text) {
        responseText = data.text
      } else if (data.data && data.data.response) {
        responseText = data.data.response
      } else if (data.data && typeof data.data === "string") {
        responseText = data.data
      } else if (data.choices && data.choices[0] && data.choices[0].message) {
        responseText = data.choices[0].message.content || data.choices[0].message.text
      } else if (data.error) {
        // Catch errors coming from our proxy route
        responseText = "" // Don't set response, set error instead
        setError(data.error)
        setStatus("error")
        return // Exit early if it's an error
      } else {
        // If none of the expected formats, try to stringify the entire response
        responseText = JSON.stringify(data, null, 2)
      }

      if (responseText && responseText.trim()) {
        setResponse(responseText.trim())
        setStatus("success")
      } else {
        setError("Received an empty or unparseable response from the AI service.")
        setStatus("error")
      }
    } catch (err) {
      console.error("Client-side error during submission:", err)
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred while submitting your request."

      // Check for specific error message patterns to give more user-friendly feedback
      if (errorMessage.includes("API key missing")) {
        setError(
          "Configuration error: Lyzr API key is not set. Please ensure LYZR_API_KEY is configured in your project environment variables.",
        )
      } else if (
        errorMessage.includes("429") ||
        errorMessage.includes("rate-limited") ||
        errorMessage.includes("temporarily busy")
      ) {
        setError("The AI service is temporarily busy (rate-limited). Please wait a moment and try again.")
      } else if (
        errorMessage.includes("Failed to connect") ||
        errorMessage.includes("Network error") ||
        errorMessage.includes("timeout")
      ) {
        setError("Network connection failed or timed out. Please check your internet connection or try again later.")
      } else {
        setError(errorMessage)
      }
      setStatus("error")
    } finally {
      setIsSubmitting(false)
    }
  }, [input, status, resetStatus])

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !isSubmitting) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit, isSubmitting],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value)
      if (status === "error") {
        resetStatus()
      }
    },
    [status, resetStatus],
  )

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Dashboard", href: "/#ai-optimizer-section" }, // Now scrolls to AI Assistant section
    { name: "AI Assistant", href: "/#ai-optimizer-section" },
  ]

  return (
    <div className="min-h-screen bg-[#0A0D14] text-white relative overflow-hidden">
      {/* Grid Background */}
      <div
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      ></div>
      {/* Radial gradient for subtle glow */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, rgba(30, 144, 255, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(138, 43, 226, 0.15) 0%, transparent 50%)
          `,
        }}
      ></div>

      <div className="relative z-20 container mx-auto px-4 py-6 md:py-8 max-w-7xl">
        {/* Navbar */}
        <nav className="flex items-center justify-between py-4 mb-16">
          <div className="flex items-center space-x-2">
            <Cloud className="h-8 w-8 text-blue-400" />
            <span className="text-2xl font-bold text-white">CostMind AI</span>
          </div>
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className={`transition-colors ${
                  pathname === link.href || (link.href.startsWith("/#") && pathname === "/")
                    ? "text-white font-semibold"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                {link.name}
              </a>
            ))}
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors">
              Get Started
            </Button>
            <a href="/#ai-optimizer-section" className="text-gray-300 hover:text-white transition-colors">
              <User className="h-6 w-6" />
            </a>
          </div>
          {/* Mobile Menu Trigger */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[250px] sm:w-[300px] bg-gray-900 border-gray-700 text-white">
                <div className="flex flex-col items-start space-y-6 pt-8">
                  {navLinks.map((link) => (
                    <a
                      key={link.name}
                      href={link.href}
                      className={`text-lg transition-colors ${
                        pathname === link.href || (link.href.startsWith("/#") && pathname === "/")
                          ? "text-white font-semibold"
                          : "text-gray-300 hover:text-white"
                      }`}
                    >
                      {link.name}
                    </a>
                  ))}
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors">
                    Get Started
                  </Button>
                  <a
                    href="/#ai-optimizer-section"
                    className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
                  >
                    <User className="h-5 w-5" />
                    <span>Profile</span>
                  </a>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="text-left py-16 md:py-24 mb-16">
          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight text-white mb-6 max-w-4xl">CostMind AI</h1>
          <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-3xl">
            Reduce cloud spending by up to 40% with our AI-powered recommendations, real-time monitoring, and
            intelligent resource allocation.
          </p>
          <div className="flex space-x-4">
            {/* Removed "Explore Dashboard" button */}
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white px-8 py-3 rounded-lg transition-colors bg-transparent"
                >
                  Learn More
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] bg-gray-900 text-white border-gray-700">
                <DialogHeader>
                  <DialogTitle className="text-blue-400">About CostMind AI</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Discover how CostMind AI can revolutionize your cloud spending.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <p className="text-gray-300">
                    CostMind AI leverages advanced artificial intelligence to analyze your cloud infrastructure and
                    workloads, identifying inefficiencies and providing actionable recommendations to significantly
                    reduce your spending.
                  </p>
                  <p className="text-gray-300">
                    Our platform offers real-time monitoring, intelligent resource allocation suggestions, and
                    predictive cost analysis, ensuring you get the most value from your cloud investments.
                  </p>
                  <ul className="list-disc list-inside text-gray-300 space-y-1">
                    <li>Automated cost anomaly detection</li>
                    <li>Optimized resource scaling</li>
                    <li>Detailed cost breakdown reports</li>
                    <li>Customizable budget alerts</li>
                  </ul>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        {/* AI Cost Optimizer Section (previously the main content) */}
        <section id="ai-optimizer-section" className="py-16">
          {" "}
          {/* Added ID here */}
          <h2 className="text-4xl font-bold text-center text-white mb-12">
            AI Cost Optimizer <span className="text-blue-400">Assistant</span>
          </h2>
          <p className="text-xl text-center text-gray-300 mb-12">
            <Sparkles className="h-6 w-6 inline-block mr-2 text-purple-400" />
            Powered by Lyzr Studio
          </p>
          {/* Input Section */}
          <Card className="shadow-xl border border-gray-700 bg-gray-900/70 backdrop-blur-sm mb-8 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-900/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <Send className="h-6 w-6 text-blue-400" />
                Describe Your AI Challenge
              </CardTitle>
              <p className="text-gray-400 mt-2">
                Share details about your AI workload, current costs, performance issues, or optimization goals.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="relative">
                <Textarea
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  placeholder="Describe your AI task, workload, or cost question..."
                  className="min-h-40 text-base resize-none border-gray-700 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 bg-gray-800/50 text-white placeholder:text-gray-500 focus:bg-gray-800"
                  disabled={isSubmitting}
                />
                <div className="absolute bottom-3 right-3 text-xs text-gray-500">{input.length}/2000</div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <p className="text-sm text-gray-400 flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700">Cmd</kbd>
                  <span>+</span>
                  <kbd className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700">Enter</kbd>
                  <span>to submit</span>
                </p>

                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !input.trim()}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:transform-none disabled:hover:shadow-none"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
                      Ask Optimizer
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          {/* Status Bar */}
          {status !== "idle" && (
            <div className="mb-8 animate-in slide-in-from-top-2 duration-500">
              {status === "loading" && (
                <Alert className="border-blue-700 bg-gradient-to-r from-blue-900/50 to-indigo-900/50 shadow-lg text-blue-200">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                  <AlertDescription className="font-medium">
                    <div className="flex items-center justify-between">
                      <span>Analyzing your request and generating optimization recommendations...</span>
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {status === "error" && (
                <Alert className="border-red-700 bg-gradient-to-r from-red-900/50 to-pink-900/50 shadow-lg text-red-200">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <AlertDescription className="font-medium">
                    <div className="space-y-2">
                      <div className="font-semibold">Error occurred:</div>
                      <div>{error}</div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {status === "success" && !isSubmitting && (
                <Alert className="border-green-700 bg-gradient-to-r from-green-900/50 to-emerald-900/50 shadow-lg text-green-200">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <AlertDescription className="font-medium">
                    Optimization recommendations generated successfully! Review the insights below.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          {/* Response Container */}
          {response && (
            <Card className="shadow-xl border border-gray-700 bg-gray-900/70 backdrop-blur-sm animate-in slide-in-from-bottom-4 duration-700 mb-8">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl text-white flex items-center gap-2">
                  <div className="relative">
                    <Sparkles className="h-6 w-6 text-purple-400" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                  AI Optimization Recommendations
                </CardTitle>
                <Separator className="mt-4 bg-gray-700" />
              </CardHeader>
              <CardContent>
                <div className="bg-gray-800/50 rounded-lg p-6 border-l-4 border-blue-500">
                  <div className="text-gray-200 leading-relaxed">
                    {(() => {
                      const formattedResponse = formatResponse(response)

                      // Check if response looks like JSON
                      if (formattedResponse.startsWith("{") || formattedResponse.startsWith("[")) {
                        return (
                          <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-900 p-4 rounded-md overflow-x-auto text-gray-200">
                            {formattedResponse}
                          </pre>
                        )
                      } else {
                        // Parse and render markdown-like content
                        return <div className="space-y-2">{parseMarkdownToJSX(formattedResponse)}</div>
                      }
                    })()}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-700">
                  <div className="flex flex-wrap gap-2 justify-between items-center">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs border-gray-600 text-gray-300 bg-gray-800">
                        <Clock className="h-3 w-3 mr-1" />
                        Generated just now
                      </Badge>
                      <Badge variant="outline" className="text-xs border-gray-600 text-gray-300 bg-gray-800">
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI-Powered by Preethi
                      </Badge>
                      <Badge variant="outline" className="text-xs border-gray-600 text-gray-300 bg-gray-800">
                        <TrendingDown className="h-3 w-3 mr-1" />
                        Cost Optimized
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(formatResponse(response))}
                      className="text-xs border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                    >
                      Copy Report
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Footer */}
        <footer className="text-center py-8 mt-12">
          <Separator className="mb-6 bg-gray-700" />
          <div className="space-y-2">
            <p className="text-gray-500 text-sm font-medium">Built with AI SDK • Powered by Lyzr Studio</p>
            <p className="text-gray-600 text-xs">Intelligent optimization for your AI workloads</p>
            <p className="text-gray-600 text-xs">Developed by Preethi G</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
