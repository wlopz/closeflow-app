import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  Download, 
  ExternalLink, 
  MoreHorizontal, 
  Play 
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Mock call data
const calls = [
  {
    id: "call-1",
    customer: "Acme Corp",
    date: "Today, 10:30 AM",
    duration: "22m 15s",
    template: "Consultative",
    status: "Closed"
  },
  {
    id: "call-2",
    customer: "TechStart Inc",
    date: "Yesterday, 2:15 PM",
    duration: "18m 42s",
    template: "Heart-to-heart",
    status: "Pending"
  },
  {
    id: "call-3",
    customer: "Global Industries",
    date: "Yesterday, 11:00 AM",
    duration: "45m 12s",
    template: "Consultative",
    status: "Closed"
  },
  {
    id: "call-4",
    customer: "Future Solutions",
    date: "Jun 15, 2025",
    duration: "15m 38s",
    template: "Direct coach",
    status: "Lost"
  },
  {
    id: "call-5",
    customer: "Bright Ideas Co",
    date: "Jun 12, 2025",
    duration: "32m 04s",
    template: "Inspirational",
    status: "Closed"
  }
];

const CallHistory = () => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Date & Time</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Template</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {calls.map((call) => (
          <TableRow key={call.id}>
            <TableCell className="font-medium">{call.customer}</TableCell>
            <TableCell>{call.date}</TableCell>
            <TableCell>{call.duration}</TableCell>
            <TableCell>{call.template}</TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={cn(
                  call.status === "Closed" && "border-green-500 text-green-500",
                  call.status === "Pending" && "border-yellow-500 text-yellow-500",
                  call.status === "Lost" && "border-red-500 text-red-500"
                )}
              >
                {call.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    <span>Listen to Recording</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    <span>View Transcript</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    <span>Download</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default CallHistory;