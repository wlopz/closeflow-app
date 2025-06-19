'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock, 
  MessageSquare, 
  Brain,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';
import { CallsService } from '@/lib/supabase/calls';
import { useToast } from '@/hooks/use-toast';

interface CallFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
  callDuration: number;
  transcripts: Array<{
    id: string;
    speaker_name: string;
    content: string;
    timestamp_offset: number;
  }>;
  insights: Array<{
    id: string;
    type: string;
    content: string;
    timestamp_offset: number;
  }>;
}

interface BehavioralFactor {
  factor: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  beta: number;
  evidence: string[];
  timestamp?: number;
  [key: string]: any;
}

export function CallFeedbackModal({ 
  isOpen, 
  onClose, 
  callId, 
  callDuration,
  transcripts,
  insights 
}: CallFeedbackModalProps) {
  const [outcome, setOutcome] = useState<'closed' | 'pending' | 'lost' | 'no_show'>('pending');
  const [notes, setNotes] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<BehavioralFactor[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && transcripts.length > 0) {
      console.log('🧠 Generating behavioral analysis with data:', {
        transcriptsCount: transcripts.length,
        insightsCount: insights.length,
        callDuration
      });
      generateBehavioralAnalysis();
    }
  }, [isOpen, transcripts, insights, callDuration]);

  const generateBehavioralAnalysis = () => {
    const factors: BehavioralFactor[] = [];
    
    console.log('📊 Analyzing conversation data:', {
      totalTranscripts: transcripts.length,
      totalInsights: insights.length,
      duration: callDuration
    });
    
    // Analyze conversation flow and timing
    const totalWords = transcripts.reduce((sum, t) => sum + t.content.split(' ').length, 0);
    const avgWordsPerMinute = totalWords / (callDuration / 60);
    
    console.log('📈 Conversation metrics:', {
      totalWords,
      avgWordsPerMinute,
      duration: callDuration / 60
    });
    
    if (avgWordsPerMinute > 150) {
      factors.push({
        factor: 'Conversation Pace',
        description: 'High-energy, fast-paced conversation indicating engagement',
        impact: 'positive',
        beta: 0.3,
        evidence: [`${Math.round(avgWordsPerMinute)} words/minute (above optimal 120-150)`]
      });
    } else if (avgWordsPerMinute < 80) {
      factors.push({
        factor: 'Conversation Pace',
        description: 'Slow conversation pace suggesting disengagement or hesitation',
        impact: 'negative',
        beta: -0.4,
        evidence: [`${Math.round(avgWordsPerMinute)} words/minute (below optimal 120-150)`]
      });
    }

    // Analyze speaker balance
    const salespersonTranscripts = transcripts.filter(t => t.speaker_name === 'You');
    const customerTranscripts = transcripts.filter(t => t.speaker_name === 'Customer');
    
    const salespersonWords = salespersonTranscripts.reduce((sum, t) => sum + t.content.split(' ').length, 0);
    const customerWords = customerTranscripts.reduce((sum, t) => sum + t.content.split(' ').length, 0);
    const talkRatio = salespersonWords / (salespersonWords + customerWords);

    console.log('🗣️ Speaker analysis:', {
      salespersonWords,
      customerWords,
      talkRatio,
      salespersonSegments: salespersonTranscripts.length,
      customerSegments: customerTranscripts.length
    });

    if (talkRatio > 0.7) {
      factors.push({
        factor: 'Talk-Listen Ratio',
        description: 'Salesperson dominated conversation - missed discovery opportunities',
        impact: 'negative',
        beta: -0.6,
        evidence: [`Salesperson: ${Math.round(talkRatio * 100)}% vs Customer: ${Math.round((1 - talkRatio) * 100)}%`]
      });
    } else if (talkRatio < 0.4) {
      factors.push({
        factor: 'Talk-Listen Ratio',
        description: 'Customer highly engaged and talking - strong buying signals',
        impact: 'positive',
        beta: 0.5,
        evidence: [`Customer: ${Math.round((1 - talkRatio) * 100)}% vs Salesperson: ${Math.round(talkRatio * 100)}%`]
      });
    } else {
      factors.push({
        factor: 'Talk-Listen Ratio',
        description: 'Balanced conversation flow - optimal discovery dynamic',
        impact: 'positive',
        beta: 0.2,
        evidence: [`Balanced ratio: ${Math.round(talkRatio * 100)}% / ${Math.round((1 - talkRatio) * 100)}%`]
      });
    }

    // Analyze question patterns
    const questions = transcripts.filter(t => 
      t.speaker_name === 'You' && 
      (t.content.includes('?') || t.content.toLowerCase().includes('what') || 
       t.content.toLowerCase().includes('how') || t.content.toLowerCase().includes('why'))
    );
    
    const questionRate = questions.length / (callDuration / 60);
    if (questionRate > 3) {
      factors.push({
        factor: 'Discovery Quality',
        description: 'High question frequency indicates strong discovery approach',
        impact: 'positive',
        beta: 0.4,
        evidence: [`${questions.length} questions in ${Math.round(callDuration / 60)} minutes`]
      });
    } else if (questionRate < 1) {
      factors.push({
        factor: 'Discovery Quality',
        description: 'Low question frequency - missed discovery opportunities',
        impact: 'negative',
        beta: -0.5,
        evidence: [`Only ${questions.length} questions in ${Math.round(callDuration / 60)} minutes`]
      });
    }

    // Analyze objection handling
    const objectionInsights = insights.filter(i => i.type === 'objection');
    if (objectionInsights.length > 0) {
      factors.push({
        factor: 'Objection Emergence',
        description: 'Customer raised concerns - indicates engagement but requires skillful handling',
        impact: 'neutral',
        beta: -0.1,
        evidence: [`${objectionInsights.length} objections identified`]
      });
    }

    // Analyze buying signals
    const buyingSignals = insights.filter(i => i.type === 'buying-signal');
    if (buyingSignals.length > 0) {
      factors.push({
        factor: 'Buying Signal Recognition',
        description: 'Customer showed interest and buying intent',
        impact: 'positive',
        beta: 0.7,
        evidence: [`${buyingSignals.length} buying signals detected`]
      });
    }

    // Analyze coaching effectiveness
    const coachingInsights = insights.filter(i => ['opportunity', 'next-step', 'good-move'].includes(i.type));
    if (coachingInsights.length > 3) {
      factors.push({
        factor: 'AI Coaching Utilization',
        description: 'High coaching engagement suggests active improvement mindset',
        impact: 'positive',
        beta: 0.2,
        evidence: [`${coachingInsights.length} coaching moments identified`]
      });
    }

    // Analyze call timing and urgency
    if (callDuration < 600) { // Less than 10 minutes
      factors.push({
        factor: 'Call Duration',
        description: 'Short call duration - insufficient time for proper discovery',
        impact: 'negative',
        beta: -0.8,
        evidence: [`${Math.round(callDuration / 60)} minutes (below optimal 15-30 min)`]
      });
    } else if (callDuration > 2700) { // More than 45 minutes
      factors.push({
        factor: 'Call Duration',
        description: 'Extended call suggests deep engagement but potential decision paralysis',
        impact: 'neutral',
        beta: -0.2,
        evidence: [`${Math.round(callDuration / 60)} minutes (above typical 15-30 min)`]
      });
    } else {
      factors.push({
        factor: 'Call Duration',
        description: 'Optimal call length for thorough discovery and presentation',
        impact: 'positive',
        beta: 0.3,
        evidence: [`${Math.round(callDuration / 60)} minutes (optimal range)`]
      });
    }

    // Analyze emotional language patterns
    const emotionalWords = ['excited', 'concerned', 'worried', 'interested', 'frustrated', 'happy', 'disappointed'];
    const emotionalMentions = transcripts.filter(t => 
      emotionalWords.some(word => t.content.toLowerCase().includes(word))
    );
    
    if (emotionalMentions.length > 0) {
      factors.push({
        factor: 'Emotional Engagement',
        description: 'Emotional language indicates high investment in the conversation',
        impact: 'positive',
        beta: 0.4,
        evidence: [`${emotionalMentions.length} emotional expressions detected`]
      });
    }

    console.log('✅ Generated behavioral analysis:', factors);
    setAnalysis(factors);
  };

  const calculatePredictedOutcome = () => {
    const totalBeta = analysis.reduce((sum, factor) => sum + factor.beta, 0);
    const probability = 1 / (1 + Math.exp(-totalBeta)); // Logistic function
    return Math.round(probability * 100);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Update call with outcome and additional details
      await CallsService.updateCall(callId, {
        outcome,
        notes,
        customer_name: customerName || undefined,
        customer_company: customerCompany || undefined,
        metadata: {
          behavioral_analysis: analysis,
          predicted_close_probability: calculatePredictedOutcome()
        }
      });

      toast({
        title: 'Call feedback saved',
        description: 'Your call analysis has been stored for future reference.',
      });

      onClose();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error saving feedback',
        description: 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'negative': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Target className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive': return 'border-green-200 bg-green-50 dark:bg-green-900/20';
      case 'negative': return 'border-red-200 bg-red-50 dark:bg-red-900/20';
      default: return 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20';
    }
  };

  const predictedProbability = calculatePredictedOutcome();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Call Analysis & Feedback
            <Badge variant="outline" className="ml-2">
              {transcripts.length} segments, {insights.length} insights
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
          {/* Left Column - Behavioral Analysis */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Behavioral Economics Analysis
                </CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {Math.round(callDuration / 60)}m {callDuration % 60}s
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    {transcripts.length} segments
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Predicted Close Probability</span>
                    <span className={`text-2xl font-bold ${
                      predictedProbability > 70 ? 'text-green-500' : 
                      predictedProbability > 40 ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {predictedProbability}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Based on conversation dynamics and behavioral indicators
                  </div>
                </div>

                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {analysis.map((factor, index) => (
                      <Card key={index} className={`p-3 ${getImpactColor(factor.impact)}`}>
                        <div className="flex items-start gap-3">
                          {getImpactIcon(factor.impact)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-medium text-sm">{factor.factor}</h4>
                              <Badge variant="outline" className="text-xs">
                                β = {factor.beta > 0 ? '+' : ''}{factor.beta}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {factor.description}
                            </p>
                            <div className="space-y-1">
                              {factor.evidence.map((evidence, i) => (
                                <div key={i} className="text-xs bg-background/50 rounded px-2 py-1">
                                  {evidence}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Call Details */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Call Outcome & Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customerName">Customer Name</Label>
                    <input
                      id="customerName"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Enter customer name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customerCompany">Company</Label>
                    <input
                      id="customerCompany"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Enter company name"
                      value={customerCompany}
                      onChange={(e) => setCustomerCompany(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Call Outcome</Label>
                  <RadioGroup value={outcome} onValueChange={(value: any) => setOutcome(value)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="closed" id="closed" />
                      <Label htmlFor="closed" className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Deal Closed
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pending" id="pending" />
                      <Label htmlFor="pending" className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-yellow-500" />
                        Follow-up Required
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="lost" id="lost" />
                      <Label htmlFor="lost" className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        Deal Lost
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no_show" id="no_show" />
                      <Label htmlFor="no_show" className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        No Show
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any additional observations, next steps, or insights..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                </div>

                <Separator />

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Analysis'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}