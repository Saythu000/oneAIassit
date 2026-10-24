'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

interface LandingPageClientProps {
  session: {
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      role?: string;
      tenantId?: string | null;
    };
  } | null;
  dbConnected: boolean;
  dbError: string | null;
}

interface ChatMessage {
  sender: 'ai' | 'user';
  content: string;
  isImage?: boolean;
  imageUrl?: string;
  timestamp: string;
}

export default function LandingPageClient({ session, dbConnected, dbError }: LandingPageClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // WhatsApp Chat Simulation State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingSender, setTypingSender] = useState<'ai' | 'user' | null>(null);
  
  const simulationScript = useRef<Array<{
    sender: 'ai' | 'user';
    content: string;
    isImage?: boolean;
    imageUrl?: string;
    delay: number;
    typingTime: number;
  }>>([
    {
      sender: 'ai',
      content: 'Hello! I saw you were interested in our new SaaS platform. How can I help you today?',
      delay: 1000,
      typingTime: 1200,
    },
    {
      sender: 'user',
      content: 'Hey! I want to know about your enterprise pricing.',
      delay: 2000,
      typingTime: 1500,
    },
    {
      sender: 'ai',
      content: 'Absolutely! Our enterprise plan starts at $499/mo and includes unlimited agents. Would you like to see a comparison chart?',
      delay: 2000,
      typingTime: 1800,
    },
    {
      sender: 'ai',
      content: "I've attached our latest pricing brochure for you!",
      isImage: true,
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDqmdrFB4dmK8ZUYi6ejSMHWytxtn55I32V-n-ehxnw_ZD-SkMcMPCVpaUM-cJuGijpwgLVnzqCdqRhGCyJwsb31o0LDdmwCPU9g72fMGlls_x_CMlzWZxvpWR3BjeaFeFYvMSjMRnXLbjdi_LVkHo6rbQHNJVoX5c5IX5BsTxYbro0Hqvq5YY-gkI2zOrQspYW8OZuaUxKOKYCUQJmeUukN22Uy3ufNsbM_TDKJwgxfnIwbSoNdrF_9Z_EbsGW9nlKYw6oq1oHwoF',
      delay: 1500,
      typingTime: 800,
    }
  ]);

  const carouselRef = useRef<HTMLDivElement>(null);

  // WhatsApp simulation hook
  useEffect(() => {
    let active = true;
    let timerId: NodeJS.Timeout;

    const runSimulation = async () => {
      // Clear messages
      setChatMessages([]);
      
      for (const step of simulationScript.current) {
        if (!active) return;
        
        // Wait before starting to type
        await new Promise((resolve) => {
          timerId = setTimeout(resolve, step.delay);
        });
        
        if (!active) return;
        
        // Start typing indicator
        setIsTyping(true);
        setTypingSender(step.sender);
        
        // Typing duration
        await new Promise((resolve) => {
          timerId = setTimeout(resolve, step.typingTime);
        });
        
        if (!active) return;
        
        // Add message
        setIsTyping(false);
        setTypingSender(null);
        
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        setChatMessages((prev) => [
          ...prev,
          {
            sender: step.sender,
            content: step.content,
            isImage: step.isImage,
            imageUrl: step.imageUrl,
            timestamp: timeString,
          },
        ]);
      }

      // Loop after 10 seconds of idle
      await new Promise((resolve) => {
        timerId = setTimeout(resolve, 10000);
      });
      if (active) {
        runSimulation();
      }
    };

    // Delay initial start
    timerId = setTimeout(() => {
      runSimulation();
    }, 1500);

    return () => {
      active = false;
      clearTimeout(timerId);
    };
  }, []);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 400;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="bg-background text-on-surface selection:bg-primary-fixed min-h-screen flex flex-col font-sans">
      {/* TopNavBar */}
      <header className="bg-surface shadow-sm sticky top-0 z-50 h-16 w-full border-b border-outline-variant/30">
        <div className="flex justify-between items-center px-margin-desktop w-full max-w-[1440px] mx-auto h-full">
          <div className="flex items-center gap-xl">
            <Link href="/" className="text-headline-md font-extrabold text-primary tracking-tight flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/OneAILogo.png" alt="OneAIAssist Logo" className="h-8 w-auto object-contain" />
              <span>OneAIAssist</span>
            </Link>
            <nav className="hidden md:flex items-center gap-lg">
              {session ? (
                <>
                  <Link href="/dashboard" className="text-primary border-b-2 border-primary pb-1 font-body-md transition-all duration-200">
                    Dashboard
                  </Link>
                  <Link href="/dashboard/ai-bot" className="text-on-surface-variant hover:text-primary transition-colors font-body-md">
                    Agents
                  </Link>
                  <Link href="/dashboard/leads" className="text-on-surface-variant hover:text-primary transition-colors font-body-md">
                    Contacts
                  </Link>
                  <Link href="/dashboard/analytics" className="text-on-surface-variant hover:text-primary transition-colors font-body-md">
                    Analytics
                  </Link>
                </>
              ) : (
                <>
                  <a href="#features" className="text-on-surface-variant hover:text-primary transition-colors font-body-md">
                    Features
                  </a>
                  <a href="#solutions" className="text-on-surface-variant hover:text-primary transition-colors font-body-md">
                    Solutions
                  </a>
                  <a href="#testimonials" className="text-on-surface-variant hover:text-primary transition-colors font-body-md">
                    Testimonials
                  </a>
                </>
              )}
            </nav>
          </div>
          
          <div className="flex items-center gap-md">
            {session ? (
              <div className="flex items-center gap-md">
                <Link href="/dashboard" className="hidden sm:inline-flex items-center justify-center bg-[#1B4B91] hover:bg-[#163e78] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs">
                  Go to Dashboard
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-slate-600 hover:text-rose-600 transition-colors text-xs font-semibold"
                >
                  Logout
                </button>
                <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200">
                  <img 
                    className="w-full h-full object-cover" 
                    alt="Profile Avatar" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuB_P6B2ccqoRkqZnQTFzijR4gfH6DDVTD8x4IpBuhz7pYD4nLEofWAPk1yeprYKe9aQSIcbuN6NGk7CfY1QorB31lyZOfRWjTk_oa59VaPVvg4AwAw8N_rrKpdhWczU1Kvb3GXZKXFw1bfCLVjIdhD5C3QYTyBRM5dYCXjFUGsYa5v-bzXXp1x2Aaw6iO-sCTH4SsF2j208mIjSnUOz5cv8ACjHypDiEYBw6tcHd1Wr_M78PE2WOFfA7FBcoz_SmhnbL2pcO9Ab5jqd" 
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-slate-700 hover:text-[#1B4B91] px-3.5 py-1.5 text-xs font-semibold transition-colors">
                  Login
                </Link>
                <Link href="/signup" className="bg-[#1B4B91] hover:bg-[#163e78] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs">
                  Get Started Free
                </Link>
              </div>
            )}
            
            {/* Mobile menu toggle */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1 text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-surface border-b border-outline-variant/40 px-margin-mobile py-4 flex flex-col gap-sm shadow-md animate-in slide-in-from-top">
            {session ? (
              <>
                <Link href="/dashboard" className="text-primary font-body-md py-2 border-b border-outline-variant/10">
                  Dashboard
                </Link>
                <Link href="/dashboard/ai-bot" className="text-on-surface-variant font-body-md py-2 border-b border-outline-variant/10">
                  Agents
                </Link>
                <Link href="/dashboard/leads" className="text-on-surface-variant font-body-md py-2 border-b border-outline-variant/10">
                  Contacts
                </Link>
                <Link href="/dashboard/analytics" className="text-on-surface-variant font-body-md py-2">
                  Analytics
                </Link>
              </>
            ) : (
              <>
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-on-surface-variant font-body-md py-2 border-b border-outline-variant/10">
                  Features
                </a>
                <a href="#solutions" onClick={() => setMobileMenuOpen(false)} className="text-on-surface-variant font-body-md py-2 border-b border-outline-variant/10">
                  Solutions
                </a>
                <a href="#testimonials" onClick={() => setMobileMenuOpen(false)} className="text-on-surface-variant font-body-md py-2">
                  Testimonials
                </a>
              </>
            )}
          </div>
        )}
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative pt-2xl pb-3xl overflow-hidden bg-gradient-to-b from-surface to-background">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-surface-container to-transparent opacity-50"></div>
          <div className="max-w-[1440px] mx-auto px-margin-desktop grid grid-cols-1 md:grid-cols-12 gap-xl items-center">
            <div className="md:col-span-6 space-y-lg">
              <h1 className="text-display-lg-mobile lg:text-display-lg font-extrabold leading-tight tracking-tight text-on-surface">
                Deploy AI Sales Agents on <span className="text-primary">WhatsApp</span> in Minutes
              </h1>
              <p className="text-body-lg text-on-surface-variant max-w-xl">
                Automate lead generation, qualify prospects, and provide 24/7 customer support with intelligent AI agents that talk like humans and close like pros.
              </p>
              <div className="flex flex-wrap gap-md pt-sm">
                <Link href="/signup" className="bg-tertiary hover:bg-[#004e5c] text-on-tertiary px-xl py-4 rounded-lg font-label-md transition-all shadow-md active:scale-95 text-center flex items-center justify-center">
                  Start Free Trial
                </Link>
                <Link href="/signup" className="bg-surface-container-lowest border border-outline/50 hover:bg-surface-container-low text-on-surface px-xl py-4 rounded-lg font-label-md transition-all active:scale-95 text-center flex items-center justify-center">
                  Book a Demo
                </Link>
              </div>
            </div>
            
            <div className="md:col-span-6 relative">
              {/* WhatsApp Mockup */}
              <div className="bg-[#E5DDD5] rounded-xl shadow-2xl overflow-hidden border-8 border-inverse-surface max-w-sm mx-auto transform md:rotate-2 hover:rotate-0 transition-transform duration-500">
                {/* WP Header */}
                <div className="bg-[#075E54] p-md flex items-center gap-sm text-white">
                  <span className="material-symbols-outlined text-md">arrow_back</span>
                  <div className="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden">
                    <img 
                      className="w-full h-full object-cover" 
                      alt="AI Sales Pro Avatar" 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuB4W-VQW51Ov_Ven6hB5noEkICSaSseGpXVjDqX0WfzDl-9khWaWh42tJf8aRd7VJ-cJWP6ht5CmJ9zsMLW7-6fXhtlZTqsYLRC2KGexH28aR85RK4sDAhPSTNW6ifCvpBHbGSFVdR37MwqRPMW1X_Xs2a0HC3a55aYfRi26jPt0C97W83DaGZAzyv4-Tt3TDCleBEvaJgkBBsP5YcRouUvOUwrvYzv6s93iRzViKYI4Y2EcU7Iji3Q_FoG-gnTKw-F2tXcvqVbe9JN" 
                    />
                  </div>
                  <div>
                    <p className="text-label-md font-bold leading-none">AI Sales Pro</p>
                    <p className="text-[10px] opacity-80 mt-1">
                      {isTyping && typingSender === 'ai' ? 'typing...' : 'Online'}
                    </p>
                  </div>
                  <div className="ml-auto flex gap-sm">
                    <span className="material-symbols-outlined text-sm">videocam</span>
                    <span className="material-symbols-outlined text-sm">call</span>
                    <span className="material-symbols-outlined text-sm">more_vert</span>
                  </div>
                </div>
                
                {/* Chat Body */}
                <div className="p-md space-y-md h-[400px] overflow-y-auto bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat flex flex-col justify-end">
                  <div className="space-y-md overflow-y-auto flex-grow max-h-[380px] pr-1 flex flex-col justify-end">
                    {chatMessages.map((msg, idx) => (
                      <div 
                        key={idx} 
                        className={`p-sm rounded-lg relative text-body-sm shadow-sm max-w-[85%] animate-in fade-in-50 duration-300 ${
                          msg.sender === 'ai' 
                            ? 'bg-white whatsapp-bubble-left self-start text-on-surface' 
                            : 'bg-[#dcf8c6] whatsapp-bubble-right self-end ml-auto text-on-surface'
                        }`}
                      >
                        {msg.isImage && msg.imageUrl && (
                          <img 
                            className="w-full h-32 object-cover rounded-md mb-2" 
                            alt="Pricing Brochure" 
                            src={msg.imageUrl} 
                          />
                        )}
                        <p>{msg.content}</p>
                        <span className="text-[9px] text-outline text-right block mt-1">{msg.timestamp}</span>
                      </div>
                    ))}
                    
                    {/* Typing Indicator Bubble */}
                    {isTyping && (
                      <div 
                        className={`p-sm rounded-lg relative text-body-sm shadow-sm max-w-[80px] flex items-center justify-center gap-1 ${
                          typingSender === 'ai' 
                            ? 'bg-white whatsapp-bubble-left self-start' 
                            : 'bg-[#dcf8c6] whatsapp-bubble-right self-end ml-auto'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-outline animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-outline animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-outline animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* WP Input */}
                <div className="p-sm bg-[#f0f0f0] flex items-center gap-sm border-t border-outline-variant/30">
                  <span className="material-symbols-outlined text-on-surface-variant cursor-pointer">mood</span>
                  <div className="flex-1 bg-white rounded-full px-md py-1.5 text-xs text-outline select-none">
                    {isTyping && typingSender === 'user' ? 'AI Sales Pro is typing...' : 'Type a message'}
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant cursor-pointer">attach_file</span>
                  <div className="w-9 h-9 rounded-full bg-[#075E54] flex items-center justify-center text-white cursor-pointer hover:opacity-90 active:scale-95 transition-all">
                    <span className="material-symbols-outlined text-sm">mic</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Bar */}
        <section className="bg-surface-container py-xl border-y border-outline-variant/20">
          <div className="max-w-[1440px] mx-auto px-margin-desktop">
            <div className="flex flex-col md:flex-row justify-around items-center gap-xl text-center">
              <div className="space-y-xs">
                <p className="text-display-lg-mobile md:text-headline-lg font-extrabold text-primary">2M+</p>
                <p className="text-label-md text-on-surface-variant uppercase tracking-widest">Conversations Handled</p>
              </div>
              <div className="w-px h-12 bg-outline-variant/60 hidden md:block"></div>
              <div className="space-y-xs">
                <p className="text-display-lg-mobile md:text-headline-lg font-extrabold text-primary">500+</p>
                <p className="text-label-md text-on-surface-variant uppercase tracking-widest">Businesses Empowered</p>
              </div>
              <div className="w-px h-12 bg-outline-variant/60 hidden md:block"></div>
              <div className="space-y-xs">
                <p className="text-display-lg-mobile md:text-headline-lg font-extrabold text-primary">40+</p>
                <p className="text-label-md text-on-surface-variant uppercase tracking-widest">Countries Reached</p>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="py-3xl">
          <div className="max-w-[1440px] mx-auto px-margin-desktop">
            <div className="text-center mb-2xl">
              <h2 className="text-headline-lg font-bold text-on-surface mb-md">Powerful Features for Modern Sales</h2>
              <p className="text-body-md text-on-surface-variant max-w-xl mx-auto">Everything you need to dominate WhatsApp marketing, lead management, and agency customer support.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
              {/* Feature Card 1 */}
              <div className="p-xl bg-surface-container-lowest border border-outline-variant/80 rounded-xl shadow-sm hover:shadow-md transition-all group duration-300">
                <div className="w-12 h-12 rounded-lg bg-primary-fixed flex items-center justify-center mb-md group-hover:bg-primary transition-colors duration-300">
                  <span className="material-symbols-outlined text-primary group-hover:text-white">smart_toy</span>
                </div>
                <h3 className="text-headline-md font-semibold mb-xs text-on-surface">AI Chatbot Engine</h3>
                <p className="text-body-sm text-on-surface-variant">Natural language processing that understands prospect intent and answers policy questions instantly.</p>
              </div>
              
              {/* Feature Card 2 */}
              <div className="p-xl bg-surface-container-lowest border border-outline-variant/80 rounded-xl shadow-sm hover:shadow-md transition-all group duration-300">
                <div className="w-12 h-12 rounded-lg bg-primary-fixed flex items-center justify-center mb-md group-hover:bg-primary transition-colors duration-300">
                  <span className="material-symbols-outlined text-primary group-hover:text-white">forum</span>
                </div>
                <h3 className="text-headline-md font-semibold mb-xs text-on-surface">Live WhatsApp Inbox</h3>
                <p className="text-body-sm text-on-surface-variant">A unified multi-agent collaborative dashboard to handle thousands of client chats seamlessly.</p>
              </div>
              
              {/* Feature Card 3 */}
              <div className="p-xl bg-surface-container-lowest border border-outline-variant/80 rounded-xl shadow-sm hover:shadow-md transition-all group duration-300">
                <div className="w-12 h-12 rounded-lg bg-primary-fixed flex items-center justify-center mb-md group-hover:bg-primary transition-colors duration-300">
                  <span className="material-symbols-outlined text-primary group-hover:text-white">leaderboard</span>
                </div>
                <h3 className="text-headline-md font-semibold mb-xs text-on-surface">Lead Pipeline &amp; CRM</h3>
                <p className="text-body-sm text-on-surface-variant">Automatically tag, track, and nurture leads from first greeting to closed insurance application.</p>
              </div>
              
              {/* Feature Card 4 */}
              <div className="p-xl bg-surface-container-lowest border border-outline-variant/80 rounded-xl shadow-sm hover:shadow-md transition-all group duration-300">
                <div className="w-12 h-12 rounded-lg bg-primary-fixed flex items-center justify-center mb-md group-hover:bg-primary transition-colors duration-300">
                  <span className="material-symbols-outlined text-primary group-hover:text-white">campaign</span>
                </div>
                <h3 className="text-headline-md font-semibold mb-xs text-on-surface">Broadcast Campaigns</h3>
                <p className="text-body-sm text-on-surface-variant">Send personalized templates in bulk safely using the official WhatsApp Cloud APIs.</p>
              </div>
              
              {/* Feature Card 5 */}
              <div className="p-xl bg-surface-container-lowest border border-outline-variant/80 rounded-xl shadow-sm hover:shadow-md transition-all group duration-300">
                <div className="w-12 h-12 rounded-lg bg-primary-fixed flex items-center justify-center mb-md group-hover:bg-primary transition-colors duration-300">
                  <span className="material-symbols-outlined text-primary group-hover:text-white">rocket_launch</span>
                </div>
                <h3 className="text-headline-md font-semibold mb-xs text-on-surface">Marketing Automation</h3>
                <p className="text-body-sm text-on-surface-variant">Trigger custom outreach messages based on website triggers or third-party CRM events.</p>
              </div>
              
              {/* Feature Card 6 */}
              <div className="p-xl bg-surface-container-lowest border border-outline-variant/80 rounded-xl shadow-sm hover:shadow-md transition-all group duration-300">
                <div className="w-12 h-12 rounded-lg bg-primary-fixed flex items-center justify-center mb-md group-hover:bg-primary transition-colors duration-300">
                  <span className="material-symbols-outlined text-primary group-hover:text-white">analytics</span>
                </div>
                <h3 className="text-headline-md font-semibold mb-xs text-on-surface">Analytics</h3>
                <p className="text-body-sm text-on-surface-variant">Deep insights into lead sources, conversion rates, agent metrics, and message delivery status.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Solutions Carousel Section */}
        <section id="solutions" className="bg-surface-dim/10 py-3xl overflow-hidden border-y border-outline-variant/10">
          <div className="max-w-[1440px] mx-auto px-margin-desktop relative">
            <div className="flex justify-between items-end mb-2xl">
              <div>
                <h2 className="text-headline-lg font-bold text-on-surface">Tailored Solutions for Your Industry</h2>
                <p className="text-body-md text-on-surface-variant mt-1">Pre-built AI conversational patterns designed to scale specialized businesses.</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => scrollCarousel('left')}
                  className="w-10 h-10 rounded-full border border-outline/30 flex items-center justify-center bg-white hover:bg-surface-container-low transition-colors shadow-sm text-on-surface active:scale-95"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button 
                  onClick={() => scrollCarousel('right')}
                  className="w-10 h-10 rounded-full border border-outline/30 flex items-center justify-center bg-white hover:bg-surface-container-low transition-colors shadow-sm text-on-surface active:scale-95"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
            
            <div 
              ref={carouselRef}
              className="flex gap-lg overflow-x-auto pb-lg snap-x snap-mandatory scrollbar-thin scroll-smooth pr-[100px]"
              style={{ scrollbarWidth: 'none' }}
            >
              {/* Case 1 */}
              <div className="min-w-[320px] md:min-w-[450px] snap-start bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant flex-shrink-0">
                <div className="h-48 relative">
                  <img 
                    className="w-full h-full object-cover" 
                    alt="Insurance solutions" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBCHm-qqUmR3qC0aPpJTaVZII5uJzVd_yweh4rhy8bvHaznaI7R6bPpGfOT5aH4QqL-pdOFpWA6J5AVO7TOoaJf40SnpA6sdtlqCd7AU8DHJe97_1KBJe0_7huru-HZEFnwhCmKKeNzs2LHYoL6hZq1LpEqA1-FmU0D0V_wPFGbF5H-2s1zi0mVZfTczFiwLF8hIfzXAbfXWpNhMR62Jh9irSjqPX_d9-otRX8MipWmzlskNTmH4WLVjFTUulwz-NQiCah9m6v0MzCx" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                  <div className="absolute bottom-md left-md text-white font-bold text-headline-md">Insurance</div>
                </div>
                <div className="p-xl space-y-md">
                  <p className="text-body-md text-on-surface">Automate claim intake, collect document PDFs, and send renewals or policy reminders directly on WhatsApp.</p>
                  <ul className="space-y-sm">
                    <li className="flex items-center gap-sm text-body-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-primary text-sm">check_circle</span> Instant quote pre-qualifications
                    </li>
                    <li className="flex items-center gap-sm text-body-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-primary text-sm">check_circle</span> Secure KYC document uploads
                    </li>
                  </ul>
                </div>
              </div>
              
              {/* Case 2 */}
              <div className="min-w-[320px] md:min-w-[450px] snap-start bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant flex-shrink-0">
                <div className="h-48 relative">
                  <img 
                    className="w-full h-full object-cover" 
                    alt="Healthcare solutions" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCLTxZ5V6KqOKfNtOt5_Y9clrGyz92TVaeIbQ1PmZ3j9kkczflHONzz57M-Axjmgd4-G8_7bIHd2h0yEPFFzOZxTvx6tUXGNkLu5DXBwIPBij1Uauzhsvdo8TY2MLNk8CfOE6cla0pVBrxYMSzpSBKrypqWatW94xdDexk_Zc3g2G94jgwjAxSKuy56cTnatE1pjUFk0vNFOIiQNjFnvVMrdfioLZKOU7TzAfLhgrAnf_Pv97nnQHj6Lh2s-5XI0NxM5dAFjQhfo9_t" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                  <div className="absolute bottom-md left-md text-white font-bold text-headline-md">Healthcare</div>
                </div>
                <div className="p-xl space-y-md">
                  <p className="text-body-md text-on-surface">Manage scheduling, patient onboarding, clinic locations, and automated post-care follow-ups securely and efficiently.</p>
                  <ul className="space-y-sm">
                    <li className="flex items-center gap-sm text-body-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-primary text-sm">check_circle</span> 24/7 Appointment booking triggers
                    </li>
                    <li className="flex items-center gap-sm text-body-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-primary text-sm">check_circle</span> HIPAA-compliant security layers
                    </li>
                  </ul>
                </div>
              </div>
              
              {/* Case 3 */}
              <div className="min-w-[320px] md:min-w-[450px] snap-start bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant flex-shrink-0">
                <div className="h-48 relative">
                  <img 
                    className="w-full h-full object-cover" 
                    alt="E-Commerce solutions" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBmzwIDvuMB64z8xTvEfECj851EjTs1CXR444kzmjr5PLWpnJNk1YFEWAehWU25Bk1IKrB7R4JAk8aozIBI4pTTgnNt07cEHMEq0JX-45PhaaEgZJOCri1Dn7XCd0iQ1J2WvvR3tj00B1DY1HEhjjJcacnZ5X4q13n_JQhDeKhOsONJp46fI8_xo4ByYX5fX1ZIzKiW_7iF5z3YrX1Xr2W0QyQnOap_jlpPoCGAakxjAaqPjopZUB2b8w4dYk2rd4g0irr8KU7aA2iy" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                  <div className="absolute bottom-md left-md text-white font-bold text-headline-md">E-Commerce</div>
                </div>
                <div className="p-xl space-y-md">
                  <p className="text-body-md text-on-surface">Recover abandoned shopping carts, resolve tracking inquiries, and distribute custom coupon brochures to buyers.</p>
                  <ul className="space-y-sm">
                    <li className="flex items-center gap-sm text-body-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-primary text-sm">check_circle</span> WhatsApp Catalog integrations
                    </li>
                    <li className="flex items-center gap-sm text-body-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-primary text-sm">check_circle</span> Auto-delivered order details
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-3xl">
          <div className="max-w-[1440px] mx-auto px-margin-desktop">
            <h2 className="text-headline-lg font-bold text-center mb-2xl text-on-surface">Loved by Innovative Leaders</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-xl">
              {/* Testimonial 1 */}
              <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant/80 shadow-sm relative flex flex-col justify-between">
                <div>
                  <div className="mb-lg h-8 relative">
                    <img 
                      className="h-8 object-contain" 
                      alt="Blue Insurance Logo" 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuC6PwgO3Dvf3PQNxuLXPNVs1hK6WdpecYjmK_z7D2kWp84IL0OKmN0j1wDY3CXbQodHgDa1L1spOwAnuX4byGrYvkXfAzQZSmmJRbEAuuVz87HC-cYtjLVJhjBvBDkZqWzLFF0xm6hutluN0qToKcV5KRdplXY3tdTPnzJrNuJL7nqL9j1HyvTrdbTR44cmRC8tDsLn-BqiNreTbomDKvIuleBsgXitgh8dPucZLBI6YP0xtGgXUrD4EyPv-5nkGL9c3RQQV5s28LQ9" 
                    />
                  </div>
                  <p className="text-body-md italic text-on-surface mb-xl">
                    &quot;OneAIAssist transformed our lead response time from hours to seconds. Our conversion rate increased by 40% in just two months.&quot;
                  </p>
                </div>
                <div className="flex items-center gap-md">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-variant flex-shrink-0">
                    <img 
                      className="w-full h-full object-cover" 
                      alt="Sarah Chen" 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuBnjGrqJRoCGco87Egt7cSLSYYfuglciZGm77TyTFt1TNF-uIMtPC8F5GVHV6uKXTIuSuPGRD741GesuqwPga5K-W6KCZjsM3Cp0AYZ0OnZkuWddU2o1GkrwtfOU8UIriaD0oz0ENusp6gL5C3Q_27RPDEi0LGNkza2bxAmFA5c8aEYB98ZVHumqiKPv2wZM4OZGyYONaH66YmroYqEw34t8A5t0rAc_w0CA1oejyB7YXvk4fnzvIpgvI_hKmUd4KTsi7q2qmXrxBCU" 
                    />
                  </div>
                  <div>
                    <p className="text-label-md font-bold text-on-surface">Sarah Chen</p>
                    <p className="text-label-sm text-on-surface-variant">CEO of Blue Insurance</p>
                  </div>
                </div>
              </div>
              
              {/* Testimonial 2 */}
              <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="mb-lg h-8 relative">
                    <img 
                      className="h-8 object-contain" 
                      alt="HealthSync Logo" 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDAllRI4RgmOHzVTzCEBGBMKwuIovcGbvPIrBiTR0Km44gNrZPNixHkbwKavhorC0-ESzJyOAaLU_l-E_j0fiTjKahlSQE72nVpuEVIoK9pgFsojmKi7vZZN67NhwxEOJR6Ij1E7bAgWoLwHqltsKLCVVhdOZFO6m-A8QBa2eUaN0xY2qGnj0aLsSUGS73lsGXW5P1EXkcUY80aYhbl2DyRDVuSnp3P2-lOM9Kxb62gNqUHNbuIgOdosnmOFTAmTiNGZeljNjqsKSo-" 
                    />
                  </div>
                  <p className="text-body-md italic text-on-surface mb-xl">
                    &quot;The integration was seamless. We deployed our first AI agent on WhatsApp in under 20 minutes. It&apos;s truly a game-changer for patient care.&quot;
                  </p>
                </div>
                <div className="flex items-center gap-md">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-variant flex-shrink-0">
                    <img 
                      className="w-full h-full object-cover" 
                      alt="Dr. James Miller" 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9Jhutp28_iCZgB4_Xy2yJV03G-iXXdLKn50YRu-QGi75oXcjaTwNR7vXsWiMEw6PHJrB_oulXNAu-2xtQCl8AolXHGHc44rW60eKfJLSalGf9AfspgBlhCfISdOzVdfLSNlRShF9zLGYigFtXCkJ3v0iKLOdluGgkeeE_SlODrkYeuhkBoUehjZGjx5PPyN8XbwwBoQx9gYF8lhWJXirpqyUal_Rdg69SjGb7pPd3E6maV1Ah8fSTUm-tNzcoUN69VL2zGtLLZ2Fg" 
                    />
                  </div>
                  <div>
                    <p className="text-label-md font-bold text-on-surface">Dr. James Miller</p>
                    <p className="text-label-sm text-on-surface-variant">COO at HealthSync</p>
                  </div>
                </div>
              </div>
              
              {/* Testimonial 3 */}
              <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="mb-lg h-8 relative">
                    <img 
                      className="h-8 object-contain" 
                      alt="ShopFlow Logo" 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCEIdAaDlJUDufrfT_1WadE8bXR__BbTNMlCXiAxBLXNrr4X5NLB_SYgIVM5OnoGKJbJuDo6m0ocdLO2Xr_NaXaT0NAzs6NfgPUwQwDNp3I_GK0aZHjun41xxXI9dvpoMHD8rCuOeIELpogz-6UUxyP_UB4CIu_1jYkLh3Pw-U82m_esRxCuklxtoo_pJB7o9LvKXzcfaG7g7P4hXrqjIV5gUmZyn74DSJoTAiyFQe6lfGelEetnA-bn3XB5QEe6vlXyjSwgu6Ehzpn" 
                    />
                  </div>
                  <p className="text-body-md italic text-on-surface mb-xl">
                    &quot;Our customer satisfaction scores soared since we started using OneAIAssist. The AI handles the repetitive queries so our staff can focus on big deals.&quot;
                  </p>
                </div>
                <div className="flex items-center gap-md">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-variant flex-shrink-0">
                    <img 
                      className="w-full h-full object-cover" 
                      alt="Alex Rivera" 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAQ9vEoVNxlNzjVT6uTlEl4L5ntV76gh4s1uVLxOyx1b9A0jtSyOmz0iiLAO8sS0qYLf0Nbf8DF0sXsHC9GlJjXxf8l0DMIYodstnSaluK1CGjObrQ3vwPNcbol79LiPBtUYdZ3ZSYkQte87W-v7Y4-Hw_EQe0aLJ7ts-ydD2mF_m9d5bTM2kak6qEm2Ctd7MzR-xSpJ_MB0sILFvNhr51Tc28s7cOj3V1ScqWwJTIqT59mceJmeOJobqu3bSWIwq9Fab6lWzraBri0" 
                    />
                  </div>
                  <div>
                    <p className="text-label-md font-bold text-on-surface">Alex Rivera</p>
                    <p className="text-label-sm text-on-surface-variant">Founder of ShopFlow</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-tertiary py-3xl text-white">
          <div className="max-w-[1440px] mx-auto px-margin-desktop text-center space-y-xl">
            <h2 className="text-display-lg-mobile md:text-display-lg font-extrabold leading-tight text-white">
              Ready to deploy your AI agent?
            </h2>
            <p className="text-body-lg text-white/90 max-w-2xl mx-auto">
              Join hundreds of insurance agencies and high-growth businesses automating client intake on WhatsApp. Start your 14-day free trial today.
            </p>
            <div className="flex flex-col sm:flex-row gap-md justify-center items-center">
              <Link href="/signup" className="bg-white text-tertiary hover:bg-surface-container-low px-3xl py-5 rounded-lg font-bold text-body-md transition-all shadow-xl active:scale-95 text-center">
                Start Free Trial
              </Link>
              <p className="text-label-md text-white/80">No credit card required.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest py-8 w-full border-t border-outline-variant/60">
        <div className="flex flex-col md:flex-row justify-between items-center px-margin-desktop max-w-[1440px] mx-auto gap-md">
          <div className="flex flex-col items-center md:items-start gap-xs">
            <span className="font-headline-sm font-bold text-primary">OneAIAssist</span>
            <p className="text-label-sm text-on-surface-variant">
              © 2024 OneAIAssist. HIPAA Compliant &amp; SOC2 Certified.
            </p>
          </div>
          
          <div className="flex items-center gap-lg">
            {/* Database status widget in footer */}
            <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1 rounded-full border border-outline-variant/30" title={dbError || undefined}>
              <span className="relative flex h-2 w-2">
                {dbConnected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </>
                )}
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono">
                {dbConnected ? 'Neon Connected' : 'Neon Error'}
              </span>
            </div>
            
            <a className="text-on-surface-variant hover:text-primary transition-colors text-label-sm" href="#">Privacy Policy</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors text-label-sm" href="#">Terms</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors text-label-sm" href="#">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
