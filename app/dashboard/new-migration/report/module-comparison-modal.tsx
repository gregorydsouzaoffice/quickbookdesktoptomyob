"use client"

import { useState } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Compass as Compare } from "lucide-react"

interface ModuleComparisonProps {
  className?: string
}

export function ModuleComparisonModal({ className }: ModuleComparisonProps) {
  const [open, setOpen] = useState(false)

  // TODO: these are placeholder captures taken from a different accounting package —
  // real QuickBooks Desktop equivalents have not been captured yet. Not evidenced in
  // screenshots. Every entry is flagged `sourcePlaceholder` so the UI can never present
  // one of them as a genuine QuickBooks Desktop screen.
  const modules = [
    {
      id: "bills",
      name: "Bills",
      sourceImage: "/images/screenshots/Source Bill 202-9171566-7320302.png",
      sourcePlaceholder: true,
      myobImage: "/images/screenshots/MYOB Bill 202-9171566-7320302.png",
      description: "Compare bill entry between QuickBooks Desktop and MYOB",
    },
    {
      id: "bank-accounts",
      name: "Bank Accounts",
      sourceImage: "/images/screenshots/Source Bank Account.jpg",
      sourcePlaceholder: true,
      myobImage: "/images/screenshots/MYOB Bank Account.png",
      description: "Compare bank account setup between QuickBooks Desktop and MYOB",
    },
    {
      id: "chart-of-accounts",
      name: "Chart of Accounts",
      sourceImage: "/images/screenshots/Source Coa Sales account code.jpg",
      sourcePlaceholder: true,
      myobImage: "/images/screenshots/MYOB Sale Account code.jpg",
      description: "Compare chart of accounts setup between QuickBooks Desktop and MYOB",
    },
    {
      id: "customers",
      name: "Customers",
      sourceImage: "/images/screenshots/Source Customer.png",
      sourcePlaceholder: true,
      myobImage: "/images/screenshots/MYOB Customer.jpg",
      description: "Compare customer management between QuickBooks Desktop and MYOB",
    },
    {
      id: "vendors",
      name: "Vendors",
      sourceImage: "/images/screenshots/Source Vendor.png",
      sourcePlaceholder: true,
      myobImage: "/images/screenshots/MYOB Supplier.png",
      description: "Compare vendor management between QuickBooks Desktop and MYOB",
    },
    {
      id: "invoices",
      name: "Invoices",
      sourceImage: "/images/screenshots/Source Inv 11.png",
      sourcePlaceholder: true,
      myobImage: "/images/screenshots/MYOB Inv 11.png",
      description: "Compare invoice creation and management between QuickBooks Desktop and MYOB",
    },
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <Compare className="mr-2 h-4 w-4" /> Compare Modules
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto border-border/50 bg-background/95 backdrop-blur-md shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold mb-4 text-foreground">
            Module Comparison: QuickBooks Desktop vs MYOB
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="bills" className="w-full">
          <TabsList className="mb-4 flex flex-wrap h-auto">
            {modules.map((module) => (
              <TabsTrigger key={module.id} value={module.id} className="px-4 py-2">
                {module.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {modules.map((module) => (
            <TabsContent key={module.id} value={module.id} className="mt-0">
              <div className="text-sm text-muted-foreground mb-4">{module.description}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <div className="font-semibold mb-2 p-2 bg-green-500/10 text-green-700 dark:text-green-400 rounded-t-md border-b border-green-500/20">
                    QuickBooks Desktop
                  </div>
                  <div className="border border-border/50 rounded-b-md p-1 bg-card/50 backdrop-blur-md">
                    {module.sourcePlaceholder && (
                      <div className="mb-1 rounded-sm bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                        Placeholder image — QuickBooks Desktop capture pending
                      </div>
                    )}
                    <div className="relative aspect-auto w-full overflow-hidden rounded-sm">
                      <Image
                        src={module.sourceImage || "/placeholder.svg"}
                        alt={`QuickBooks Desktop ${module.name}`}
                        width={600}
                        height={400}
                        className="object-contain w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="font-semibold mb-2 p-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-t-md border-b border-red-500/20">MYOB</div>
                  <div className="border border-border/50 rounded-b-md p-1 bg-card/50 backdrop-blur-md">
                    <div className="relative aspect-auto w-full overflow-hidden rounded-sm">
                      <Image
                        src={module.myobImage || "/placeholder.svg"}
                        alt={`MYOB ${module.name}`}
                        width={600}
                        height={400}
                        className="object-contain w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
