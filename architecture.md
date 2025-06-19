# CloseFlow - System Architecture

## Overview

CloseFlow is an AI-powered sales assistant platform built with Next.js, Tailwind CSS, and Supabase. The system comprises a web application and a Chrome extension for real-time sales call assistance.

## Core Components

### 1. Web Application
- **Frontend**: Next.js with Tailwind CSS for a responsive, modern UI
- **Backend**: Serverless API routes via Next.js
- **Authentication**: Supabase Auth for user authentication and management
- **Database**: Supabase PostgreSQL for data storage

### 2. Chrome Extension
- **Frontend**: React with Tailwind CSS
- **Communication**: WebSockets for real-time data exchange with the web app
- **Audio Processing**: WebRTC for audio capture and processing

### 3. AI Services
- **Transcription**: OpenAI Whisper API for real-time speech-to-text
- **Analysis**: OpenAI GPT-4 for conversation analysis and guidance generation
- **Context Management**: Vector database for maintaining conversation context

## Data Flow

1. **Call Initiation**:
   - User starts a call through the Chrome extension
   - Extension captures audio stream via WebRTC
   - Audio is sent to the server for processing

2. **Real-time Processing**:
   - Audio is transcribed using Whisper API
   - Transcription is analyzed by GPT-4 to identify:
     - Customer intent and sentiment
     - Key topics and pain points
     - Potential objections
     - Opportunities for closing

3. **Guidance Generation**:
   - AI generates real-time prompts based on the analysis
   - Prompts are prioritized and filtered based on relevance
   - High-priority prompts are immediately sent to the Chrome extension

4. **Feedback Loop**:
   - User actions and call outcomes are recorded
   - System learns from successful and unsuccessful interactions
   - Guidance models are continuously refined

## Database Schema

### Users Table
- user_id (PK)
- email
- name
- role
- subscription_tier
- created_at

### Calls Table
- call_id (PK)
- user_id (FK)
- customer_name
- start_time
- end_time
- duration
- status (active, completed, cancelled)
- template_id (FK)
- transcript_url
- recording_url

### Templates Table
- template_id (PK)
- user_id (FK)
- name
- description
- style (heart-to-heart, consultative, challenging, direct, inspirational)
- created_at
- updated_at

### Prompts Table
- prompt_id (PK)
- call_id (FK)
- timestamp
- type (suggestion, warning, opportunity)
- content
- was_followed (boolean)

### Analytics Table
- analytics_id (PK)
- user_id (FK)
- call_id (FK)
- close_rate
- avg_call_duration
- objection_count
- successful_redirects
- template_effectiveness

## Scalability Considerations

1. **Serverless Architecture**:
   - Next.js API routes and Supabase functions scale automatically
   - No need to manage dedicated servers

2. **Database Performance**:
   - Use connection pooling for efficient database access
   - Implement caching for frequently accessed data
   - Use indexing for optimized query performance

3. **Real-time Processing**:
   - Use streaming APIs for efficient audio processing
   - Implement backpressure mechanisms to handle high volumes
   - Consider batch processing for non-critical analysis

## Security Measures

1. **Data Protection**:
   - End-to-end encryption for call data
   - Secure storage of sensitive information
   - Compliance with data protection regulations (GDPR, CCPA)

2. **Authentication**:
   - JWT-based authentication
   - Role-based access control
   - Multi-factor authentication option

3. **Extension Security**:
   - Strict permissions model
   - Secure communication channels
   - Regular security audits

## Deployment Strategy

- **Web Application**: Deploy to Netlify for static site generation and serverless functions
- **Database**: Supabase managed PostgreSQL database
- **Chrome Extension**: Publish to Chrome Web Store
- **CI/CD**: GitHub Actions for automated testing and deployment