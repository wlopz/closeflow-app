'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Clock, 
  User, 
  Building, 
  TrendingUp, 
  TrendingDown, 
  Target,
  Eye,
  Calendar,
  MessageSquare,
  Brain,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MoreHorizontal,
  Lightbulb,
  AlertCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CallsService } from '@/lib/supabase/calls';
import { useAuth } from '@/lib/supabase/hooks';
import { cn } from '@/lib/utils';

interface CallHistoryDetailedProps {
  refreshTrigger?: number;
}

interface CallWithDetails {
  id: string;
  customer_name: string | null;
  customer_company: string | null;
  status: string;
  outcome: string | null;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  notes: string | null;
  metadata: any;
  created_at: string;
}

export function CallHistoryDetailed({ refreshTrigger }: CallHistoryDetailedProps) {
  const [calls, setCalls] = useState<CallWithDetails[]>([]);
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchCalls();
    }
  }, [user, refreshTrigger]);

  const fetchCalls = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const callsData = await CallsService.getUserCalls(user.id);
      setCalls(callsData);
    } catch (error) {
      console.error('Error fetching calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (callId: string) => {
    setLoadingDetails(true);
    try {
      console.log('🔍 Fetching details for call:', callId);
      
      // Debug: Check what's actually in the database
      await CallsService.debugCallData(callId);
      
      const details = await CallsService.getCallDetails(callId);
      console.log('📊 Retrieved call details:', details);
      
      setSelectedCall(details);
      setShowDetails(true);
    } catch (error) {
      console.error('Error fetching call details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const getOutcomeIcon = (outcome: string | null) => {
    switch (outcome) {
      case 'closed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'lost': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'no_show': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getOutcomeBadge = (outcome: string | null) => {
    switch (outcome) {
      case 'closed':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Closed</Badge>;
      case 'lost':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Lost</Badge>;
      case 'no_show':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">No Show</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'objection': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'opportunity': return <Lightbulb className="h-4 w-4 text-blue-500" />;
      case 'buying-signal': return <Target className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'good-move': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'next-step': return <TrendingUp className="h-4 w-4 text-purple-500" />;
      default: return <Brain className="h-4 w-4 text-gray-500" />;
    }
  };

  const getInsightBadgeColor = (type: string) => {
    switch (type) {
      case 'objection': return 'bg-red-100 text-red-800 border-red-200';
      case 'opportunity': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'buying-signal': return 'bg-green-100 text-green-800 border-green-200';
      case 'warning': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'good-move': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'next-step': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const renderBehavioralAnalysis = (metadata: any) => {
    if (!metadata?.behavioral_analysis) return null;

    const analysis = metadata.behavioral_analysis;
    const probability = metadata.predicted_close_probability;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Behavioral Economics Analysis</h4>
          {probability && (
            <Badge variant="outline" className="text-lg px-3 py-1">
              {probability}% Close Probability
            </Badge>
          )}
        </div>
        
        <div className="grid gap-3">
          {analysis.map((factor: any, index: number) => (
            <Card key={index} className={cn(
              "p-3",
              factor.impact === 'positive' ? 'border-green-200 bg-green-50 dark:bg-green-900/20' :
              factor.impact === 'negative' ? 'border-red-200 bg-red-50 dark:bg-red-900/20' :
              'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20'
            )}>
              <div className="flex items-start gap-3">
                {factor.impact === 'positive' ? <TrendingUp className="h-4 w-4 text-green-500 mt-0.5" /> :
                 factor.impact === 'negative' ? <TrendingDown className="h-4 w-4 text-red-500 mt-0.5" /> :
                 <Target className="h-4 w-4 text-yellow-500 mt-0.5" />}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-medium text-sm">{factor.factor}</h5>
                    <Badge variant="outline" className="text-xs">
                      β = {factor.beta > 0 ? '+' : ''}{factor.beta}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {factor.description}
                  </p>
                  {factor.evidence && (
                    <div className="space-y-1">
                      {factor.evidence.map((evidence: string, i: number) => (
                        <div key={i} className="text-xs bg-background/50 rounded px-2 py-1">
                          {evidence}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Call History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Loading call history...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Call History
            {calls.length > 0 && (
              <Badge variant="outline">{calls.length} calls</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No calls recorded yet</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Analysis</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {call.customer_name || 'Unknown Customer'}
                        </div>
                        {call.customer_company && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {call.customer_company}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{formatDate(call.start_time)}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(call.start_time).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatDuration(call.duration_seconds)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getOutcomeIcon(call.outcome)}
                        {getOutcomeBadge(call.outcome)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {call.metadata?.predicted_close_probability ? (
                        <div className="flex items-center gap-2">
                          <Brain className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {call.metadata.predicted_close_probability}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No analysis</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={loadingDetails}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleViewDetails(call.id)}
                            className="flex items-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Call Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Call Details & Analysis
              {loadingDetails && (
                <div className="ml-2 text-sm text-muted-foreground">Loading...</div>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedCall && !loadingDetails && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
              {/* Left Column - Call Info & Transcript */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Call Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Customer:</span>
                        <div className="font-medium">
                          {selectedCall.call?.customer_name || 'Unknown'}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Company:</span>
                        <div className="font-medium">
                          {selectedCall.call?.customer_company || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Duration:</span>
                        <div className="font-medium">
                          {formatDuration(selectedCall.call?.duration_seconds)}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Outcome:</span>
                        <div>{getOutcomeBadge(selectedCall.call?.outcome)}</div>
                      </div>
                    </div>
                    
                    {selectedCall.call?.notes && (
                      <>
                        <Separator />
                        <div>
                          <span className="text-muted-foreground text-sm">Notes:</span>
                          <p className="text-sm mt-1">{selectedCall.call.notes}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Conversation Transcript</span>
                      <Badge variant="outline">
                        {selectedCall.transcripts?.length || 0} segments
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedCall.transcripts?.length > 0 ? (
                      <ScrollArea className="h-96">
                        <div className="space-y-4">
                          {selectedCall.transcripts.map((transcript: any, index: number) => (
                            <div key={transcript.id || index} className="flex gap-3">
                              <div className={cn(
                                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                                transcript.speaker_name === 'You' 
                                  ? "bg-blue-500 text-white" 
                                  : "bg-green-500 text-white"
                              )}>
                                {transcript.speaker_name === 'You' ? 'Y' : 'C'}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium">
                                    {transcript.speaker_name || `Speaker ${transcript.speaker_id + 1}`}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimestamp(transcript.timestamp_offset || 0)}
                                  </span>
                                </div>
                                <p className="text-sm leading-relaxed">{transcript.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="flex items-center justify-center h-32 text-muted-foreground">
                        <div className="text-center">
                          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No transcript available</p>
                          <p className="text-xs">Transcripts are saved during live calls</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Analysis & Insights */}
              <div className="space-y-4">
                {selectedCall.call?.metadata && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Brain className="h-5 w-5" />
                        Behavioral Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-64">
                        {renderBehavioralAnalysis(selectedCall.call.metadata)}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5" />
                        AI Insights
                      </span>
                      <Badge variant="outline">
                        {selectedCall.insights?.length || 0} insights
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedCall.insights?.length > 0 ? (
                      <ScrollArea className="h-96">
                        <div className="space-y-3">
                          {selectedCall.insights.map((insight: any, index: number) => (
                            <div key={insight.id || index} className="p-3 border rounded-lg">
                              <div className="flex items-start gap-3">
                                {getInsightIcon(insight.type)}
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <Badge className={getInsightBadgeColor(insight.type)}>
                                      {insight.type.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {formatTimestamp(insight.timestamp_offset || 0)}
                                    </span>
                                  </div>
                                  <p className="text-sm leading-relaxed">{insight.content}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="flex items-center justify-center h-32 text-muted-foreground">
                        <div className="text-center">
                          <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No AI insights available</p>
                          <p className="text-xs">Insights are generated during live calls</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {loadingDetails && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-muted-foreground">Loading call details...</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}