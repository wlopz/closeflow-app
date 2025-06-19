"use client";

import { useState } from 'react';
import { 
  BarChart, 
  Calendar, 
  Clock, 
  Headset, 
  LineChart, 
  MessageSquare, 
  Mic, 
  Phone, 
  Play,
  PieChart,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DashboardNav from '@/components/dashboard/dashboard-nav';
import CallHistory from '@/components/dashboard/call-history';
import { Progress } from '@/components/ui/progress';
import { 
  AreaChart, 
  Area, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip
} from 'recharts';

// Mock data
const chartData = [
  { name: 'Mon', calls: 4, closes: 1 },
  { name: 'Tue', calls: 5, closes: 2 },
  { name: 'Wed', calls: 7, closes: 3 },
  { name: 'Thu', calls: 3, closes: 1 },
  { name: 'Fri', calls: 6, closes: 3 },
  { name: 'Sat', calls: 2, closes: 1 },
  { name: 'Sun', calls: 0, closes: 0 },
];

export default function DashboardPage() {
  const [isCallActive, setIsCallActive] = useState(false);
  
  return (
    <div className="flex min-h-screen">
      <DashboardNav />
      
      <div className="flex-1 space-y-4 p-8 md:p-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <p className="text-muted-foreground">
              Welcome back! Here's what's happening with your sales.
            </p>
          </div>
          <Button
            onClick={() => setIsCallActive(!isCallActive)}
            className="gap-2"
            variant={isCallActive ? "destructive" : "default"}
          >
            {isCallActive ? (
              <>
                <Phone className="h-4 w-4" />
                End Call
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                Start New Call
              </>
            )}
          </Button>
        </div>
        
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="practice">Practice</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Calls
                  </CardTitle>
                  <Headset className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">27</div>
                  <p className="text-xs text-muted-foreground">
                    +8% from last week
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Close Rate
                  </CardTitle>
                  <LineChart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">42%</div>
                  <p className="text-xs text-muted-foreground">
                    +12% from last month
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Avg. Call Length
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">18m 42s</div>
                  <p className="text-xs text-muted-foreground">
                    -2m from last week
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Upcoming Calls
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">3</div>
                  <p className="text-xs text-muted-foreground">
                    Next call in 2 hours
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="lg:col-span-4">
                <CardHeader>
                  <CardTitle>Weekly Performance</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.2}/>
                        </linearGradient>
                        <linearGradient id="colorCloses" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0.2}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="name" 
                        stroke="currentColor" 
                        strokeOpacity={0.5} 
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="currentColor" 
                        strokeOpacity={0.5} 
                        fontSize={12}
                      />
                      <CartesianGrid 
                        stroke="currentColor" 
                        strokeOpacity={0.1} 
                        strokeDasharray="3 3" 
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--background)',
                          borderColor: 'var(--border)',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'var(--foreground)' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="calls" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorCalls)" 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="closes" 
                        stroke="#22c55e" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorCloses)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    Your latest call outcomes and insights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    <div className="flex items-center">
                      <div className="mr-4 rounded-full bg-primary/10 p-2">
                        <Headset className="h-4 w-4 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Call with Acme Corp.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Today at 10:30 AM · 22m 15s
                        </p>
                      </div>
                      <div className="ml-auto font-medium text-green-500">Closed</div>
                    </div>
                    
                    <div className="flex items-center">
                      <div className="mr-4 rounded-full bg-primary/10 p-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Follow-up with TechStart
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Yesterday at 2:15 PM · 18m 42s
                        </p>
                      </div>
                      <div className="ml-auto font-medium text-yellow-500">Pending</div>
                    </div>
                    
                    <div className="flex items-center">
                      <div className="mr-4 rounded-full bg-primary/10 p-2">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Demo for Global Industries
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Yesterday at 11:00 AM · 45m 12s
                        </p>
                      </div>
                      <div className="ml-auto font-medium text-green-500">Closed</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid gap-4 grid-cols-1">
              <Card>
                <CardHeader>
                  <CardTitle>Call History</CardTitle>
                  <CardDescription>
                    Your recent calls and their outcomes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CallHistory />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Close Rate by Template</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-80">
                  <div className="flex flex-col space-y-4 w-full">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Heart-to-heart</span>
                        <span>58%</span>
                      </div>
                      <Progress value={58} className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Consultative</span>
                        <span>42%</span>
                      </div>
                      <Progress value={42} className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Challenging</span>
                        <span>37%</span>
                      </div>
                      <Progress value={37} className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Direct coach</span>
                        <span>45%</span>
                      </div>
                      <Progress value={45} className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Inspirational</span>
                        <span>61%</span>
                      </div>
                      <Progress value={61} className="bg-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Common Objections</CardTitle>
                </CardHeader>
                <CardContent className="h-80 flex items-center justify-center">
                  <div className="w-full space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Price concerns</span>
                        <span className="text-muted-foreground">38%</span>
                      </div>
                      <Progress value={38} className="bg-red-200/20" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Need to consult team</span>
                        <span className="text-muted-foreground">24%</span>
                      </div>
                      <Progress value={24} className="bg-orange-200/20" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Competing solutions</span>
                        <span className="text-muted-foreground">18%</span>
                      </div>
                      <Progress value={18} className="bg-yellow-200/20" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>No current need</span>
                        <span className="text-muted-foreground">12%</span>
                      </div>
                      <Progress value={12} className="bg-blue-200/20" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Implementation concerns</span>
                        <span className="text-muted-foreground">8%</span>
                      </div>
                      <Progress value={8} className="bg-purple-200/20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>AI Guidance Impact</CardTitle>
                </CardHeader>
                <CardContent className="h-80 flex items-center justify-center">
                  <div className="space-y-8 w-full">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Objection handling</span>
                        <span className="font-medium">+28%</span>
                      </div>
                      <Progress value={78} className="h-2 bg-muted" />
                      <p className="text-xs text-muted-foreground">
                        AI prompts helped navigate objections more effectively
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Call duration</span>
                        <span className="font-medium">-12%</span>
                      </div>
                      <Progress value={42} className="h-2 bg-muted" />
                      <p className="text-xs text-muted-foreground">
                        Calls became more efficient while maintaining quality
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Discovery quality</span>
                        <span className="font-medium">+32%</span>
                      </div>
                      <Progress value={82} className="h-2 bg-muted" />
                      <p className="text-xs text-muted-foreground">
                        Better questions revealed deeper customer needs
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="templates" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Heart-to-heart</CardTitle>
                  <CardDescription>
                    Empathetic, connection-focused approach
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Best for: Building rapport with prospects who value relationships
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Success rate:</span>
                        <span className="text-sm font-medium">58%</span>
                      </div>
                      <Progress value={58} className="bg-muted" />
                    </div>
                  </div>
                </CardContent>
                <div className="px-6 py-4 flex justify-between items-center border-t">
                  <Button variant="outline" size="sm">Edit</Button>
                  <Button size="sm" className="gap-2">
                    <Play className="h-4 w-4" />
                    Practice
                  </Button>
                </div>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Consultative</CardTitle>
                  <CardDescription>
                    Problem-solving focused approach
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Best for: Complex sales with technical decision-makers
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Success rate:</span>
                        <span className="text-sm font-medium">42%</span>
                      </div>
                      <Progress value={42} className="bg-muted" />
                    </div>
                  </div>
                </CardContent>
                <div className="px-6 py-4 flex justify-between items-center border-t">
                  <Button variant="outline" size="sm">Edit</Button>
                  <Button size="sm" className="gap-2">
                    <Play className="h-4 w-4" />
                    Practice
                  </Button>
                </div>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Challenging</CardTitle>
                  <CardDescription>
                    Thought-provoking, disruptive approach
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Best for: Prospects comfortable with direct conversations
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Success rate:</span>
                        <span className="text-sm font-medium">37%</span>
                      </div>
                      <Progress value={37} className="bg-muted" />
                    </div>
                  </div>
                </CardContent>
                <div className="px-6 py-4 flex justify-between items-center border-t">
                  <Button variant="outline" size="sm">Edit</Button>
                  <Button size="sm" className="gap-2">
                    <Play className="h-4 w-4" />
                    Practice
                  </Button>
                </div>
              </Card>
            </div>
            
            <div className="flex justify-center mt-8">
              <Button className="gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                Create New Template
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="practice" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Objection Handling</CardTitle>
                  <CardDescription>
                    Practice overcoming common sales objections
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm">
                      Scenarios focused on price concerns, timing issues, and competitive alternatives.
                    </p>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">15 min session</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">5 scenarios</span>
                    </div>
                  </div>
                </CardContent>
                <div className="p-6 pt-0">
                  <Button className="w-full gap-2">
                    <Play className="h-4 w-4" />
                    Start Practice
                  </Button>
                </div>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Discovery Excellence</CardTitle>
                  <CardDescription>
                    Improve your discovery questioning skills
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm">
                      Learn to ask high-impact questions that uncover genuine customer needs.
                    </p>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">20 min session</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">3 scenarios</span>
                    </div>
                  </div>
                </CardContent>
                <div className="p-6 pt-0">
                  <Button className="w-full gap-2">
                    <Play className="h-4 w-4" />
                    Start Practice
                  </Button>
                </div>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Closing Techniques</CardTitle>
                  <CardDescription>
                    Master the art of the close
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm">
                      Practice different closing methods tailored to various customer types.
                    </p>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">25 min session</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">4 scenarios</span>
                    </div>
                  </div>
                </CardContent>
                <div className="p-6 pt-0">
                  <Button className="w-full gap-2">
                    <Play className="h-4 w-4" />
                    Start Practice
                  </Button>
                </div>
              </Card>
            </div>
            
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle>Practice History</CardTitle>
                  <CardDescription>
                    Your recent practice sessions and performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex items-center">
                      <div className="mr-4 rounded-full bg-primary/10 p-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium leading-none">
                          Discovery Excellence
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Yesterday at 3:45 PM · 18m
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-sm font-medium leading-none">
                          Score: 82%
                        </p>
                        <p className="text-sm text-muted-foreground">
                          +12% improvement
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <div className="mr-4 rounded-full bg-primary/10 p-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium leading-none">
                          Objection Handling
                        </p>
                        <p className="text-sm text-muted-foreground">
                          2 days ago · 15m
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-sm font-medium leading-none">
                          Score: 75%
                        </p>
                        <p className="text-sm text-muted-foreground">
                          +8% improvement
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <div className="mr-4 rounded-full bg-primary/10 p-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium leading-none">
                          Closing Techniques
                        </p>
                        <p className="text-sm text-muted-foreground">
                          3 days ago · 22m
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-sm font-medium leading-none">
                          Score: 68%
                        </p>
                        <p className="text-sm text-muted-foreground">
                          +5% improvement
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}