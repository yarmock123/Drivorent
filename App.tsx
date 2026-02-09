import React, { useState, useRef, useMemo, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Loader2, Check, AlertTriangle, Camera, Home, Calendar, Car, User, 
  ArrowLeft, Search, Clock, Plus, Star, ChevronRight, XCircle, MapPin, 
  Percent, Filter, Wind, Bluetooth, Video, Smartphone, Sun, Baby, 
  Mountain, Coins, ToggleRight, ToggleLeft, CreditCard, CheckCircle, 
  Wallet, ArrowUpRight, Landmark, FileText, AlertCircle, LogOut, Globe,
  ShieldCheck, ArrowDownLeft, Settings, ScanFace
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Vehicle, Booking, BookingStatus, User as UserType, VehicleCategory } from './types';
import { MOCK_VEHICLES, MOCK_BOOKINGS, CITIES } from './constants';

// --- Shared Utilities ---

// Formats with currency symbol (for prices)
const formatCOP = (amount: number) => {
  const formattedAmount = new Intl.NumberFormat('es-CO', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `$ ${formattedAmount}`;
};

// Formats number without symbol (for Wallet Balance and Credits)
const formatNumber = (amount: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const urlToBase64 = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
        });
    } catch (e) {
        console.error("Error converting URL to base64", e);
        return "";
    }
};

const validateImageWithGemini = async (base64Image: string, type: string) => {
    if (!process.env.API_KEY) {
        console.warn("API_KEY not set, skipping AI validation");
        return { isValid: true };
    }
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
        if (!matches) return { isValid: false, reason: 'Invalid image format' };
        
        const mimeType = matches[1];
        const data = matches[2];

        // Using gemini-2.5-flash-image
        const model = 'gemini-2.5-flash-image';
        
        let promptText = "";
        if (type === 'vehicle') {
            promptText = "Analyze this image. Is it a real vehicle (car, motorcycle, suv)? Return JSON: { \"isValid\": boolean, \"reason\": string }";
        } else if (type === 'document') {
            promptText = "Analyze this image. Is it a legible document? Return JSON: { \"isValid\": boolean, \"reason\": string }";
        } else if (type === 'face') {
            promptText = "Analyze this image. Is it a clear human face? Return JSON: { \"isValid\": boolean, \"reason\": string }";
        }

        const response = await ai.models.generateContent({
            model: model,
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: promptText }
                ]
            },
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text;
        if (!text) return { isValid: false, reason: 'No response from AI' };
        
        return JSON.parse(text);
    } catch (error) {
        console.error("AI Validation Error", error);
        return { isValid: true }; // Fallback
    }
};

// --- Shared Components ---

const Button: React.FC<{ 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success';
  className?: string;
  fullWidth?: boolean;
  disabled?: boolean;
}> = ({ children, onClick, variant = 'primary', className = '', fullWidth = false, disabled = false }) => {
  const baseStyles = "py-3 px-6 rounded-xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-brand-600 text-white shadow-lg shadow-brand-500/30 hover:bg-brand-700",
    secondary: "bg-white text-slate-800 shadow-sm border border-slate-100 hover:bg-slate-50",
    outline: "border-2 border-brand-600 text-brand-600 hover:bg-brand-50",
    danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
    success: "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-700"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

const InputGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5 mb-4">
    <label className="text-sm font-medium text-slate-600 ml-1">{label}</label>
    {children}
  </div>
);

const ImageUploadBox: React.FC<{ 
  label: string; 
  subLabel?: string; 
  image?: string; 
  onImageSelect: (url: string) => void;
  required?: boolean;
  validationType?: 'vehicle' | 'document' | 'face'; 
}> = ({ label, subLabel, image, onImageSelect, required = false, validationType }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("El archivo excede 5MB");
      setStatus('error');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMsg("Solo formatos JPG o PNG");
      setStatus('error');
      return;
    }

    setErrorMsg(null);
    setStatus('uploading');
    setProgress(0);

    let currentProgress = 0;
    const uploadInterval = setInterval(() => {
      currentProgress += 20;
      if (currentProgress > 90) clearInterval(uploadInterval);
      else setProgress(currentProgress);
    }, 200);

    try {
        const base64 = await fileToBase64(file);
        
        clearInterval(uploadInterval);
        setProgress(100);
        setStatus('analyzing'); 

        if (validationType) {
            const aiResult = await validateImageWithGemini(base64, validationType);
            if (!aiResult.isValid) {
                setStatus('error');
                setErrorMsg(aiResult.reason || "Imagen no válida");
                return;
            }
        }

        setStatus('success');
        const url = URL.createObjectURL(file);
        onImageSelect(url);

    } catch (err) {
        console.error(err);
        setStatus('error');
        setErrorMsg("Error al procesar");
    }
  };

  const getBorderColor = () => {
      if (status === 'error') return 'border-red-300 bg-red-50';
      if (status === 'success' || image) return 'border-emerald-400 bg-emerald-50';
      if (status === 'analyzing') return 'border-brand-300 bg-brand-50';
      return 'border-slate-300 hover:border-brand-400 hover:bg-slate-50 border-dashed';
  };

  return (
    <div 
      onClick={() => (status !== 'uploading' && status !== 'analyzing') && fileInputRef.current?.click()}
      className={`relative rounded-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden aspect-[4/3] flex flex-col items-center justify-center p-2 text-center group ${getBorderColor()}`}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/jpeg, image/png, image/webp"
      />
      
      {(status === 'uploading' || status === 'analyzing') && (
        <div className="absolute inset-0 z-20 bg-white/95 flex flex-col items-center justify-center p-4 animate-in fade-in">
           <Loader2 className={`animate-spin mb-2 ${status === 'analyzing' ? 'text-brand-600' : 'text-slate-400'}`} size={24} />
           <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">
               {status === 'analyzing' ? 'IA Verificando...' : `Subiendo ${progress}%`}
           </span>
           {status === 'analyzing' && (
             <div className="flex gap-1 mt-1">
                <span className="w-1 h-1 bg-brand-600 rounded-full animate-bounce delay-75"></span>
                <span className="w-1 h-1 bg-brand-600 rounded-full animate-bounce delay-150"></span>
                <span className="w-1 h-1 bg-brand-600 rounded-full animate-bounce delay-300"></span>
             </div>
           )}
        </div>
      )}

      {(image && status !== 'uploading' && status !== 'analyzing') ? (
        <>
          <img src={image} alt="Upload" className="absolute inset-0 w-full h-full object-cover opacity-60 transition-opacity group-hover:opacity-40" />
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-emerald-900/5">
             <div className="bg-emerald-50 text-white rounded-full p-1.5 mb-1 shadow-sm animate-in zoom-in duration-300 scale-90">
                <Check size={16} strokeWidth={3} />
             </div>
             <span className="text-[9px] font-bold text-emerald-800 bg-white/90 px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm">
               Aprobado
             </span>
          </div>
        </>
      ) : (
        (status === 'idle' || status === 'error') && (
          <>
             <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 group-hover:scale-110 transition-transform 
               ${status === 'error' ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-400 group-hover:text-brand-500 group-hover:bg-brand-50'}`}>
                {status === 'error' ? <AlertTriangle size={16} /> : <Camera size={16} />}
             </div>
             <p className={`text-[10px] font-bold leading-tight px-1 ${status === 'error' ? 'text-red-600' : 'text-slate-600'}`}>
               {errorMsg || label}
             </p>
             <p className="text-[9px] text-slate-400 mt-0.5">
               {status === 'error' ? 'Intenta de nuevo' : (subLabel || (required ? '*Requerido' : 'Opcional'))}
             </p>
          </>
        )
      )}
    </div>
  );
};

const BottomNav = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path ? "text-brand-600" : "text-slate-400";

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <Link to="/" className={`flex flex-col items-center gap-1 ${isActive('/')}`}>
        <Home size={24} strokeWidth={isActive('/') ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Inicio</span>
      </Link>
      <Link to="/reservations" className={`flex flex-col items-center gap-1 ${isActive('/reservations')}`}>
        <Calendar size={24} strokeWidth={isActive('/reservations') ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Reservas</span>
      </Link>
      <Link to="/my-vehicles" className={`flex flex-col items-center gap-1 ${isActive('/my-vehicles')}`}>
        <Car size={24} strokeWidth={isActive('/my-vehicles') ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Mis Autos</span>
      </Link>
      <Link to="/profile" className={`flex flex-col items-center gap-1 ${isActive('/profile')}`}>
        <User size={24} strokeWidth={isActive('/profile') ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Perfil</span>
      </Link>
    </div>
  );
};

const Header: React.FC<{ title?: string; showBack?: boolean; onBack?: () => void }> = ({ title, showBack = false, onBack }) => {
  const navigate = useNavigate();
  const handleBack = onBack || (() => navigate(-1));
  
  return (
    <div className="flex items-center justify-between p-4 sticky top-0 bg-white/80 backdrop-blur-md z-40 border-b border-slate-100 transition-all">
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600">
            <ArrowLeft size={24} />
          </button>
        )}
        {title ? (
          <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        ) : (
          <span className="text-xl font-bold text-brand-600 flex items-center gap-1">
            <Car className="fill-brand-600" size={24} /> DrivoRent
          </span>
        )}
      </div>
      {!title && (
         <Link to="/profile" className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
           <User size={20} />
         </Link>
      )}
    </div>
  );
};

// --- Page Components ---

const HomePage = ({ setFilterContext, vehicles }: { setFilterContext: any, vehicles: Vehicle[] }) => {
  const navigate = useNavigate();
  const [city, setCity] = useState('Bogotá');
  const verifiedVehicles = useMemo(() => vehicles.filter(v => v.verificationStatus === 'verified' && v.isAvailable), [vehicles]);

  const handleSearch = () => {
    setFilterContext({ city, startDate: '', endDate: '' });
    navigate('/search');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 overflow-y-auto no-scrollbar relative">
        <div className="bg-brand-900 h-[280px] w-full rounded-b-[40px] px-6 pt-8 relative z-0">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                       <Car className="text-white" size={20} />
                    </div>
                    <span className="text-white font-bold text-lg tracking-tight">DrivoRent</span>
                </div>
                <Link to="/profile" className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center backdrop-blur-md overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=100&q=80" className="w-full h-full object-cover" alt="Profile" />
                </Link>
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-2 leading-tight">
                Encuentra el auto <br/> perfecto para ti
            </h1>
            <p className="text-brand-200 text-sm">Renta vehículos únicos de personas locales.</p>
        </div>

        <div className="px-6 -mt-24 relative z-10">
            <div className="bg-white rounded-3xl shadow-xl shadow-brand-900/10 p-6">
                <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                            <MapPin size={20} />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Ciudad</p>
                            <select 
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className="w-full bg-transparent text-slate-900 font-semibold text-sm focus:outline-none appearance-none"
                            >
                                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-1">
                                <Calendar size={14} className="text-brand-600" />
                                <p className="text-[10px] uppercase text-slate-400 font-bold">Fechas</p>
                            </div>
                            <input type="date" className="w-full bg-transparent text-slate-900 font-semibold text-sm focus:outline-none" />
                        </div>
                        <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-1">
                                <Clock size={14} className="text-brand-600" />
                                <p className="text-[10px] uppercase text-slate-400 font-bold">Hora</p>
                            </div>
                            <input type="time" defaultValue="10:00" className="w-full bg-transparent text-slate-900 font-semibold text-sm focus:outline-none" />
                        </div>
                    </div>

                    <button 
                        onClick={handleSearch}
                        className="w-full bg-brand-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand-600/30 hover:bg-brand-700 transition-transform active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Search size={20} />
                        Buscar Vehículo
                    </button>
                </div>
            </div>
        </div>

        <div className="px-6 mt-8">
            <div className="bg-slate-900 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-center min-h-[140px]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500 rounded-full blur-[60px] opacity-50 -mr-10 -mt-10"></div>
                <div className="relative z-10 w-2/3">
                    <h3 className="text-white font-bold text-lg mb-1">Pon tu auto a trabajar</h3>
                    <p className="text-slate-300 text-xs mb-4 leading-relaxed">
                        Gana dinero extra rentando tu vehículo de forma segura.
                    </p>
                    <button 
                        onClick={() => navigate('/my-vehicles')}
                        className="bg-white text-slate-900 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 w-fit hover:bg-slate-200 transition"
                    >
                        <Plus size={14} />
                        Inscribir Auto
                    </button>
                </div>
                <img 
                    src="https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=200" 
                    className="absolute -right-4 bottom-0 h-32 w-auto object-cover opacity-80 mix-blend-overlay"
                    alt="Car"
                />
            </div>
        </div>

        <div className="px-6 mt-8 mb-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">Cerca de ti</h3>
                <button className="text-brand-600 text-sm font-medium">Ver mapa</button>
            </div>
            <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar">
                {verifiedVehicles.map((car, i) => (
                    <Link to={`/vehicle/${car.id}`} key={i} className="min-w-[200px] bg-white rounded-2xl p-3 shadow-sm border border-slate-100 block">
                        <div className="h-28 w-full rounded-xl bg-slate-100 overflow-hidden mb-3 relative">
                            <img src={car.imageUrl} alt={car.model} className="w-full h-full object-cover" />
                            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                <Star size={10} className="text-yellow-500 fill-yellow-500" />
                                <span className="text-[10px] font-bold">4.9</span>
                            </div>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm">{car.make} {car.model}</h4>
                        <div className="flex justify-between items-center mt-1">
                            <p className="text-xs text-slate-500"><span className="font-bold text-slate-900 text-base">{formatCOP(car.pricePerDay)}</span>/día</p>
                            <div className="w-6 h-6 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
                                <ChevronRight size={14} />
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    </div>
  );
};

const SearchPage = ({ vehicles, filterContext }: { vehicles: Vehicle[], filterContext: any }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const searchableVehicles = useMemo(() => vehicles.filter(v => v.verificationStatus === 'verified' && v.isAvailable), [vehicles]);

  const suggestions = useMemo(() => {
    if (!searchQuery) return [];
    const term = searchQuery.toLowerCase();
    const uniqueSuggestions = new Set<string>();
    searchableVehicles.forEach(v => {
      const matchesContext = !filterContext.city || v.location === filterContext.city;
      if (matchesContext) {
         if (v.make.toLowerCase().includes(term)) uniqueSuggestions.add(v.make);
         if (v.model.toLowerCase().includes(term)) uniqueSuggestions.add(v.model);
      }
    });
    return Array.from(uniqueSuggestions).sort().slice(0, 6);
  }, [searchQuery, searchableVehicles, filterContext]);

  const filteredVehicles = searchableVehicles.filter(v => {
    const matchesContext = !filterContext.city || v.location === filterContext.city;
    if (!matchesContext) return false;
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return (v.make.toLowerCase().includes(term) || v.model.toLowerCase().includes(term) || v.year.toString().includes(term));
  });

  return (
    <div className="pb-24">
      <Header title={`Vehículos en ${filterContext.city || 'Colombia'}`} showBack />
      <div className="sticky top-[61px] z-30 bg-slate-50 px-5 pt-3 pb-3 -mt-1 shadow-sm">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-10 py-3 border-0 rounded-xl bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            placeholder="Buscar marca o modelo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
              <XCircle size={16} fill="currentColor" className="text-slate-200" />
            </button>
          )}
        </div>
        {suggestions.length > 0 && (
           <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
             {suggestions.map((s, i) => (
               <button key={i} onClick={() => setSearchQuery(s)} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:text-brand-600 hover:border-brand-200 whitespace-nowrap transition-colors">
                 {s}
               </button>
             ))}
           </div>
        )}
      </div>
      <div className="px-5 py-4">
        {filteredVehicles.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><Search size={24} className="text-slate-400" /></div>
            <h3 className="text-slate-800 font-semibold">No encontramos resultados</h3>
            <p className="text-slate-500 text-sm mt-1">Intenta con otra marca o modelo.</p>
            <button onClick={() => setSearchQuery('')} className="mt-4 text-brand-600 font-medium text-sm">Limpiar búsqueda</button>
          </div>
        ) : (
          <div className="grid gap-5">
            {filteredVehicles.map(vehicle => (
              <Link to={`/vehicle/${vehicle.id}`} key={vehicle.id} className="block bg-white rounded-2xl overflow-hidden shadow-md border border-slate-100 active:scale-[0.98] transition-transform">
                <div className="h-40 w-full relative">
                  <img src={vehicle.imageUrl} alt={vehicle.model} className="w-full h-full object-cover" />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold text-brand-600">{vehicle.category}</div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">{vehicle.make} {vehicle.model}</h3>
                      <p className="text-xs text-slate-500">{vehicle.year} • {vehicle.features.transmission}</p>
                    </div>
                    <div className="text-right">
                      <span className="block font-bold text-brand-600">{formatCOP(vehicle.pricePerDay)}</span>
                      <span className="text-[10px] text-slate-400">/día</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                     {vehicle.features.hasAC && <span className="px-2 py-1 bg-slate-50 text-slate-500 text-[10px] rounded-md border border-slate-100">A/C</span>}
                     {vehicle.features.hasGPS && <span className="px-2 py-1 bg-slate-50 text-slate-500 text-[10px] rounded-md border border-slate-100">GPS</span>}
                     <span className="px-2 py-1 bg-slate-50 text-slate-500 text-[10px] rounded-md border border-slate-100">{vehicle.features.fuel}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const VehicleDetailPage = ({ vehicles, userCredits, onBook }: { vehicles: Vehicle[], userCredits: number, onBook: (v: Vehicle, creditDeduction: number) => void }) => {
  const location = useLocation();
  const vehicleId = location.pathname.split('/').pop();
  const vehicle = vehicles.find(v => v.id === vehicleId);
  const [showPayment, setShowPayment] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [useCredits, setUseCredits] = useState(true);

  if (!vehicle) return <div>Vehículo no encontrado</div>;
  
  const totalPrice = vehicle.pricePerDay;
  const creditDeduction = useCredits ? Math.min(userCredits, totalPrice) : 0;
  const cardCharge = totalPrice - creditDeduction;

  const handlePayment = () => {
    setProcessing(true);
    setTimeout(() => {
      onBook(vehicle, creditDeduction);
      setProcessing(false);
      setShowPayment(false);
    }, 2000);
  };

  const FeatureItem = ({ icon: Icon, label, value }: { icon: any, label: string, value: string }) => (
    <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-600 shadow-sm shrink-0">
            <Icon size={16}/>
        </div>
        <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
            <span className="text-xs font-semibold text-slate-700">{value}</span>
        </div>
    </div>
  );

  return (
    <div className="pb-24 bg-white min-h-screen">
       <div className="relative h-72 w-full">
         <img src={vehicle.imageUrl} className="w-full h-full object-cover" alt={vehicle.model} />
         <button onClick={() => window.history.back()} className="absolute top-4 left-4 w-10 h-10 bg-white/50 backdrop-blur rounded-full flex items-center justify-center text-slate-800">
            <ChevronRight className="rotate-180" size={24} />
         </button>
       </div>

       <div className="-mt-6 relative bg-white rounded-t-3xl p-6 shadow-[-10px_-10px_30px_rgba(0,0,0,0.1)]">
         <div className="flex justify-between items-start mb-6">
            <div>
               <span className="text-brand-600 text-sm font-semibold tracking-wider uppercase">{vehicle.category}</span>
               <h1 className="text-2xl font-bold text-slate-900 mt-1">{vehicle.make} {vehicle.model}</h1>
               <div className="flex items-center gap-1 text-slate-500 text-sm mt-1">
                 <MapPin size={14} /> {vehicle.location}
               </div>
            </div>
            <div className="text-right">
               <div className="text-2xl font-bold text-slate-900">{formatCOP(vehicle.pricePerDay)}</div>
               <div className="text-slate-400 text-xs">por día</div>
            </div>
         </div>

         {/* PROMOTIONS SECTION */}
         {vehicle.discounts && (
            <div className="mb-6 bg-brand-50 border border-brand-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Percent size={18} className="text-brand-600" />
                    <h3 className="font-bold text-brand-800 text-sm">Promociones por duración</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {vehicle.discounts.weekly > 0 && (
                        <div className="bg-white p-2 rounded-lg text-center shadow-sm border border-brand-100">
                            <span className="block text-lg font-bold text-brand-600">{vehicle.discounts.weekly}%</span>
                            <span className="text-[10px] text-slate-500 uppercase font-bold">7+ Días</span>
                        </div>
                    )}
                    {vehicle.discounts.biweekly > 0 && (
                        <div className="bg-white p-2 rounded-lg text-center shadow-sm border border-brand-100">
                            <span className="block text-lg font-bold text-brand-600">{vehicle.discounts.biweekly}%</span>
                            <span className="text-[10px] text-slate-500 uppercase font-bold">15+ Días</span>
                        </div>
                    )}
                    {vehicle.discounts.monthly > 0 && (
                        <div className="bg-white p-2 rounded-lg text-center shadow-sm border border-brand-100">
                            <span className="block text-lg font-bold text-brand-600">{vehicle.discounts.monthly}%</span>
                            <span className="text-[10px] text-slate-500 uppercase font-bold">30+ Días</span>
                        </div>
                    )}
                </div>
            </div>
         )}

         <div className="mb-6">
            <h3 className="font-bold text-slate-800 mb-3">Características</h3>
            <div className="grid grid-cols-2 gap-3">
              <FeatureItem icon={Car} label="Transmisión" value={vehicle.features.transmission} />
              <FeatureItem icon={Filter} label="Combustible" value={vehicle.features.fuel} />
              <FeatureItem icon={User} label="Pasajeros" value={`${vehicle.features.passengers} Personas`} />
              {vehicle.features.hasAC && <FeatureItem icon={Wind} label="Confort" value="Aire Acondicionado" />}
              {vehicle.features.hasGPS && <FeatureItem icon={MapPin} label="Navegación" value="GPS Integrado" />}
              {vehicle.features.hasBluetooth && <FeatureItem icon={Bluetooth} label="Audio" value="Bluetooth" />}
              {vehicle.features.hasReverseCamera && <FeatureItem icon={Video} label="Seguridad" value="Cámara Reversa" />}
              {vehicle.features.hasAndroidAuto && <FeatureItem icon={Smartphone} label="Conectividad" value="Android/CarPlay" />}
              {vehicle.features.hasSunroof && <FeatureItem icon={Sun} label="Extras" value="Sunroof" />}
              {vehicle.features.hasBabySeat && <FeatureItem icon={Baby} label="Familia" value="Silla Bebé" />}
              {vehicle.features.is4x4 && <FeatureItem icon={Mountain} label="Tracción" value="4x4 / AWD" />}
            </div>
         </div>

         <div className="mb-8">
            <h3 className="font-bold text-slate-800 mb-3">Descripción del Propietario</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
               Vehículo en excelentes condiciones, mantenimiento al día. Ideal para viajes en familia o negocios. Se entrega limpio y con tanque lleno.
            </p>
         </div>
       </div>

       <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-5 bg-white border-t border-slate-100 z-40">
          <Button fullWidth onClick={() => setShowPayment(true)}>
             Reservar Ahora
          </Button>
       </div>

       {showPayment && (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-5 backdrop-blur-sm">
           <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
             {!processing ? (
               <>
                 <h2 className="text-xl font-bold mb-4">Resumen de Pago</h2>
                 <div className="space-y-4 mb-6">
                   <div className="bg-slate-50 p-3 rounded-xl">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-500">Total Reserva</span>
                        <span className="font-bold text-slate-800 text-lg">{formatCOP(totalPrice)}</span>
                      </div>
                      <p className="text-xs text-slate-400">{vehicle.make} {vehicle.model} • 1 Día</p>
                   </div>
                   
                   {/* Credits Payment */}
                   {userCredits > 0 && (
                     <div className="border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                                <Coins size={16} />
                             </div>
                             <div>
                                <p className="text-sm font-bold text-slate-800">Usar Créditos COP</p>
                                <p className="text-xs text-yellow-600 font-semibold">Disponibles: {formatNumber(userCredits)}</p>
                             </div>
                         </div>
                         <button onClick={() => setUseCredits(!useCredits)} className="text-brand-600">
                            {useCredits ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-slate-300" />}
                         </button>
                     </div>
                   )}

                   {/* Cost Breakdown */}
                   {useCredits && userCredits > 0 && (
                       <div className="flex justify-between text-sm px-2">
                            <span className="text-emerald-600 font-medium">Descuento Créditos</span>
                            <span className="text-emerald-600 font-bold">- {formatCOP(creditDeduction)}</span>
                       </div>
                   )}

                   <div className="h-px bg-slate-100"></div>

                   <div className="flex justify-between items-center px-2">
                     <span className="text-sm font-bold text-slate-700">Total a Pagar (Tarjeta)</span>
                     <span className="text-xl font-bold text-brand-600">{formatCOP(cardCharge)}</span>
                   </div>

                   {cardCharge > 0 && (
                        <div className="flex items-center gap-3 p-3 border border-brand-200 bg-brand-50 rounded-xl">
                            <CreditCard className="text-brand-600" />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-slate-800">Tarjeta **** 4242</p>
                                <p className="text-xs text-slate-500">Pago seguro procesado</p>
                            </div>
                        </div>
                   )}
                 </div>

                 <Button fullWidth onClick={handlePayment}>
                     {cardCharge === 0 ? 'Confirmar Pago con Créditos' : `Pagar ${formatCOP(cardCharge)}`}
                 </Button>
                 
                 <button onClick={() => setShowPayment(false)} className="w-full text-center mt-3 text-sm text-slate-400 font-medium">Cancelar</button>
               </>
             ) : (
               <div className="text-center py-8">
                 <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4"></div>
                 <h3 className="text-lg font-bold text-slate-800">Procesando pago...</h3>
                 <p className="text-sm text-slate-500">Validando transacción</p>
               </div>
             )}
           </div>
         </div>
       )}
    </div>
  );
};
const ReservationsPage = ({ bookings, onAddReview, onUpdateStatus, onCancelBooking }: { bookings: Booking[], onAddReview: (id: string, rating: number, comment: string) => void, onUpdateStatus: (id: string, status: BookingStatus) => void, onCancelBooking: (id: string) => void }) => {
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);

  const handleOpenReview = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setRating(0);
    setComment('');
    setReviewModalOpen(true);
  };

  const handleFinishRental = (id: string) => {
    onUpdateStatus(id, BookingStatus.FINISHED);
    setTimeout(() => handleOpenReview(id), 500);
  };

  const handleSubmitReview = () => {
    if (selectedBookingId && rating > 0) {
      onAddReview(selectedBookingId, rating, comment);
      setReviewModalOpen(false);
    }
  };

  const handleCancelClick = (id: string) => {
      setShowCancelConfirm(id);
  };

  const confirmCancellation = (id: string) => {
      onCancelBooking(id);
      setShowCancelConfirm(null);
  };

  const getStatusStyle = (status: BookingStatus) => {
      switch (status) {
          case BookingStatus.IN_PROGRESS: return 'bg-emerald-100 text-emerald-600 border border-emerald-200';
          case BookingStatus.CONFIRMED: return 'bg-blue-100 text-brand-600 border border-blue-200'; 
          case BookingStatus.PENDING: return 'bg-orange-100 text-orange-600 border border-orange-200';
          case BookingStatus.FINISHED: return 'bg-slate-100 text-slate-500 border border-slate-200';
          case BookingStatus.CANCELLED: return 'bg-red-100 text-red-600 border border-red-200';
          default: return 'bg-slate-100 text-slate-500';
      }
  };

  const formatDateRange = (start: string, end: string) => {
      const s = new Date(start);
      const e = new Date(end);
      return `${s.getDate()} ${s.toLocaleString('default', { month: 'short' })} - ${e.getDate()} ${e.toLocaleString('default', { month: 'short' })}`;
  };

  return (
    <div className="p-6 pb-24 h-full overflow-y-auto no-scrollbar bg-slate-50">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Mis Rentas</h1>

        <div className="space-y-4">
            {bookings.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="mx-auto text-slate-300 mb-3" size={48} />
                  <p className="text-slate-500 text-sm">No tienes reservas aún.</p>
                </div>
            ) : (
                bookings.map((booking) => (
                    <div key={booking.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden">
                        {/* Cancel Overlay */}
                        {showCancelConfirm === booking.id && (
                            <div className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center text-center p-4 animate-in fade-in">
                                <AlertTriangle className="text-red-500 mb-2" size={24} />
                                <h4 className="font-bold text-slate-800">¿Cancelar reserva?</h4>
                                <p className="text-xs text-slate-500 mb-3 w-3/4 mx-auto">
                                    Se te reembolsará el <strong>90% en Créditos DrivoRent</strong>. El 10% restante cubre gastos administrativos al dueño.
                                </p>
                                <div className="bg-slate-50 p-3 rounded-lg w-full mb-4">
                                   <div className="flex justify-between text-sm mb-1">
                                      <span className="text-slate-500">Valor Reserva:</span>
                                      <span className="font-semibold">{formatCOP(booking.totalPrice)}</span>
                                   </div>
                                   <div className="flex justify-between text-sm text-emerald-600 font-bold">
                                      <span>Créditos COP (90%):</span>
                                      <span>+ {formatCOP(booking.totalPrice * 0.9)}</span>
                                   </div>
                                </div>

                                <div className="flex gap-2 w-full">
                                    <Button onClick={() => setShowCancelConfirm(null)} variant="secondary" fullWidth className="py-2 text-xs">No, volver</Button>
                                    <Button onClick={() => confirmCancellation(booking.id)} variant="danger" fullWidth className="py-2 text-xs">Sí, cancelar</Button>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 relative">
                                <img src={booking.vehicleSnapshot.imageUrl} alt={booking.vehicleSnapshot.model} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/5"></div>
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-bold text-slate-900 leading-tight">{booking.vehicleSnapshot.make} {booking.vehicleSnapshot.model}</h3>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${getStatusStyle(booking.status)}`}>
                                        {booking.status}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mb-2">{booking.vehicleSnapshot.category}</p>
                                
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <div className="bg-slate-50 p-2 rounded-xl flex items-center gap-2">
                                         <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                                            <Calendar size={14} />
                                         </div>
                                         <div className="flex flex-col overflow-hidden">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">Fecha</span>
                                            <span className="text-xs font-semibold text-slate-700 truncate">{formatDateRange(booking.startDate, booking.endDate)}</span>
                                         </div>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-xl flex items-center gap-2">
                                         <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-red-500 shadow-sm shrink-0">
                                            <MapPin size={14} />
                                         </div>
                                         <div className="flex flex-col overflow-hidden">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">Ciudad</span>
                                            <span className="text-xs font-semibold text-slate-700 truncate">{booking.vehicleSnapshot.location}</span>
                                         </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center min-h-[40px]">
                            {/* Cancellation Button Logic */}
                            {(booking.status === BookingStatus.PENDING || booking.status === BookingStatus.CONFIRMED) && (
                                <button 
                                    onClick={() => handleCancelClick(booking.id)}
                                    className="text-xs font-bold text-red-500 flex items-center gap-1 bg-red-50 px-2 py-1.5 rounded-lg hover:bg-red-100 transition-colors mr-2"
                                >
                                    <XCircle size={12} /> Cancelar
                                </button>
                            )}

                            {booking.status === BookingStatus.IN_PROGRESS && (
                                <div className="flex items-center gap-2 ml-auto">
                                   <button className="text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
                                        <Clock size={12} />
                                        Extender
                                    </button>
                                    <button 
                                      onClick={() => handleFinishRental(booking.id)}
                                      className="text-xs font-bold text-white flex items-center gap-1 bg-brand-600 px-3 py-1.5 rounded-lg shadow-sm hover:bg-brand-700 transition-colors"
                                    >
                                        <CheckCircle size={12} />
                                        Finalizar Viaje
                                    </button>
                                </div>
                            )}

                            {booking.status === BookingStatus.FINISHED && !booking.review && (
                                <button 
                                  onClick={() => handleOpenReview(booking.id)}
                                  className="text-xs font-bold text-brand-600 flex items-center gap-1 bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-100 hover:bg-brand-100 transition-colors ml-auto"
                                >
                                    <Star size={12} className="fill-brand-600" />
                                    Calificar experiencia
                                </button>
                            )}

                            {booking.status === BookingStatus.FINISHED && booking.review && (
                                <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-md border border-yellow-100 ml-auto">
                                   <div className="flex">
                                     {[...Array(5)].map((_, i) => (
                                       <Star 
                                         key={i} 
                                         size={10} 
                                         className={`${i < (booking.review?.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`} 
                                       />
                                     ))}
                                   </div>
                                   <span className="text-[10px] font-bold text-yellow-700 ml-1">Tu calificación</span>
                                </div>
                            )}
                            
                            {(booking.status !== BookingStatus.IN_PROGRESS && booking.status !== BookingStatus.FINISHED) && (
                                <div className="flex items-center gap-1 text-brand-600 cursor-pointer hover:underline ml-auto">
                                  <span className="text-xs font-bold">Ver Detalles</span>
                                  <ChevronRight size={14} />
                                </div>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>

        {reviewModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-5 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
               <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-yellow-100">
                     <Star size={32} className="text-yellow-400 fill-yellow-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Califica tu experiencia</h2>
                  <p className="text-sm text-slate-500 mt-1">¿Qué tal estuvo el vehículo?</p>
               </div>

               <div className="flex justify-center gap-2 mb-6">
                 {[1, 2, 3, 4, 5].map((star) => (
                   <button 
                     key={star} 
                     onClick={() => setRating(star)}
                     className="transition-transform hover:scale-110 focus:outline-none"
                   >
                     <Star 
                       size={32} 
                       className={`${rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'} transition-colors`} 
                     />
                   </button>
                 ))}
               </div>

               <div className="mb-6">
                 <label className="text-sm font-bold text-slate-700 mb-2 block">Comentario (Opcional)</label>
                 <textarea 
                   className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[100px]"
                   placeholder="Cuéntanos más sobre el vehículo y el anfitrión..."
                   value={comment}
                   onChange={(e) => setComment(e.target.value)}
                 />
               </div>

               <Button fullWidth onClick={handleSubmitReview} disabled={rating === 0}>
                  Enviar Calificación
               </Button>
               <button 
                 onClick={() => setReviewModalOpen(false)} 
                 className="w-full text-center mt-3 text-sm text-slate-400 font-medium hover:text-slate-600"
               >
                 Cancelar
               </button>
            </div>
          </div>
        )}
    </div>
  );
};

const ProfilePage = ({ walletBalance, userCredits, user }: { walletBalance: number, userCredits: number, user: any }) => {
  const navigate = useNavigate();
  return (
    <div className="pb-24">
      <Header title="Mi Perfil" />
      <div className="px-5 mt-4">
         {/* Profile Card - CLICKABLE */}
         <div 
           onClick={() => navigate('/personal-info')}
           className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 mb-6 cursor-pointer hover:bg-slate-50 transition-colors group relative"
         >
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-slate-400 text-2xl font-bold overflow-hidden border-2 border-slate-100 group-hover:border-brand-200 transition-colors">
               <img src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=200&q=80" alt="Profile" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
               <h2 className="text-lg font-bold text-slate-900">{user.name}</h2>
               <p className="text-sm text-slate-500">CC. {user.cedula}</p>
               <div className={`text-xs px-2 py-0.5 rounded-md mt-1 inline-flex items-center gap-1 ${
                   user.isVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
               }`}>
                  {user.isVerified ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                  {user.isVerified ? 'Usuario Verificado' : 'Verificación Pendiente'}
               </div>
            </div>
            <ChevronRight className="text-slate-300 group-hover:text-brand-400" />
         </div>

         {/* Wallet Section */}
         <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl shadow-lg shadow-slate-300 mb-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
            
            {/* CREDITS BADGE - TOP RIGHT */}
            <div className="absolute top-4 right-4 bg-white/10 backdrop-blur border border-white/20 rounded-full px-3 py-1.5 flex items-center gap-2">
                <div className="w-5 h-5 bg-yellow-400 text-yellow-900 rounded-full flex items-center justify-center shadow-sm">
                    <Coins size={12} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col leading-none">
                    <span className="text-[9px] text-slate-300 uppercase font-bold tracking-wider">Créditos (COP)</span>
                    <span className="text-xs font-bold text-white">{formatNumber(userCredits)}</span>
                </div>
            </div>

            <div className="relative z-10 mt-2">
               <div className="flex items-center gap-2 mb-2 text-slate-300 text-sm">
                  <Wallet size={16} /> Billetera DrivoRent
               </div>
               <h3 className="text-3xl font-bold mb-1">{formatNumber(walletBalance)}</h3>
               <p className="text-xs text-slate-400 mb-6">Ganancias disponibles</p>
               
               <div className="flex gap-2">
                  <button 
                    onClick={() => navigate('/withdraw')} 
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-900/20"
                  >
                    <ArrowUpRight size={16} /> Retirar
                  </button>
                  <button 
                    onClick={() => navigate('/add-account')} 
                    className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors flex flex-col items-center justify-center gap-1"
                  >
                    <Landmark size={16} /> Cuentas
                  </button>
               </div>
            </div>
         </div>

         {/* Menu Options */}
         <div className="space-y-2">
            <button onClick={() => navigate('/personal-info')} className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
               <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><User size={20} /></div>
               <span className="font-medium text-slate-700 flex-1 text-left">Información Personal</span>
               <ChevronRight size={18} className="text-slate-400" />
            </button>
            <button className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
               <div className="p-2 bg-green-50 text-green-600 rounded-lg"><FileText size={20} /></div>
               <span className="font-medium text-slate-700 flex-1 text-left">Términos y Condiciones</span>
               <ChevronRight size={18} className="text-slate-400" />
            </button>
            <button className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
               <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><AlertCircle size={20} /></div>
               <span className="font-medium text-slate-700 flex-1 text-left">Ayuda y Soporte</span>
               <ChevronRight size={18} className="text-slate-400" />
            </button>
            <button className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors mt-6">
               <div className="p-2 bg-red-50 text-red-600 rounded-lg"><LogOut size={20} /></div>
               <span className="font-medium text-red-600 flex-1 text-left">Cerrar Sesión</span>
            </button>
         </div>

         {/* Website Footer */}
         <div className="mt-8 text-center pb-4">
            <p className="text-xs text-slate-400 mb-1">Visita nuestra web</p>
            <a href="https://www.drivorent.com.co" target="_blank" rel="noopener noreferrer" className="text-brand-600 font-bold text-sm hover:underline flex items-center justify-center gap-1">
               <Globe size={14} /> www.Drivorent.com.co
            </a>
            <p className="text-[10px] text-slate-300 mt-4">Version 1.0.0</p>
         </div>
      </div>
    </div>
  );
};

const PersonalInfoPage = ({ user, onUpdateUser }: { user: any, onUpdateUser: (u: any) => void }) => {
  const [formData, setFormData] = useState(user);
  const [editing, setEditing] = useState(false);
  const [isVerifyingBiometrics, setIsVerifyingBiometrics] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{match: boolean, reason: string} | null>(null);

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSave = () => {
    onUpdateUser(formData);
    setEditing(false);
  };

  const handleDocUpload = (docType: string, url: string) => {
      const newDocs = { ...formData.verificationDocs, [docType]: url };
      const updatedUser = { ...formData, verificationDocs: newDocs };
      setFormData(updatedUser);
  };

  const handleRunBiometricCheck = async () => {
    if (!formData.verificationDocs?.front || !formData.verificationDocs?.selfie) return;

    setIsVerifyingBiometrics(true);
    setVerificationResult(null);
    try {
        const idBase64 = await urlToBase64(formData.verificationDocs.front);
        const selfieBase64 = await urlToBase64(formData.verificationDocs.selfie);

        // Simulated check
        setTimeout(() => {
             setVerificationResult({ match: true, reason: "Verified successfully" });
             onUpdateUser({ ...formData, isVerified: true });
             setFormData(prev => ({ ...prev, isVerified: true }));
             setIsVerifyingBiometrics(false);
        }, 2000);

    } catch (e) {
        console.error(e);
        setVerificationResult({ match: false, reason: "Error al procesar la verificación biométrica." });
        setIsVerifyingBiometrics(false);
    } 
  };

  return (
    <div className="pb-24 bg-white min-h-screen">
      <Header title="Datos Personales" showBack />
      <div className="p-6">
         <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">Tu Información</h2>
            <button onClick={() => editing ? handleSave() : setEditing(true)} className="text-brand-600 font-bold text-sm">
                {editing ? 'Guardar' : 'Editar'}
            </button>
         </div>

         <div className="space-y-4 mb-8">
            <InputGroup label="Nombre Completo">
                <input disabled={!editing} value={formData.name} onChange={(e) => handleChange('name', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500 disabled:opacity-70" />
            </InputGroup>
            <InputGroup label="Cédula">
                <input disabled={!editing} value={formData.cedula} onChange={(e) => handleChange('cedula', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500 disabled:opacity-70" />
            </InputGroup>
            <InputGroup label="Celular">
                <input disabled={!editing} value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500 disabled:opacity-70" />
            </InputGroup>
            <InputGroup label="Correo Electrónico">
                <input disabled={!editing} value={formData.email} onChange={(e) => handleChange('email', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500 disabled:opacity-70" />
            </InputGroup>
         </div>

         <h2 className="text-xl font-bold text-slate-800 mb-4">Verificación de Identidad</h2>
         <div className="grid grid-cols-2 gap-4">
             <ImageUploadBox 
                label="Cédula Frontal" 
                image={formData.verificationDocs?.front} 
                onImageSelect={(url) => handleDocUpload('front', url)} 
                required 
                validationType="document"
             />
             <ImageUploadBox 
                label="Cédula Posterior" 
                image={formData.verificationDocs?.back} 
                onImageSelect={(url) => handleDocUpload('back', url)} 
                required 
                validationType="document"
             />
             <div className="col-span-2">
                <ImageUploadBox 
                    label="Selfie con Cédula" 
                    subLabel="Sostén tu cédula cerca de tu rostro"
                    image={formData.verificationDocs?.selfie} 
                    onImageSelect={(url) => handleDocUpload('selfie', url)} 
                    required 
                    validationType="face"
                />
             </div>
         </div>

         <div className="mt-6">
            {!formData.isVerified && formData.verificationDocs?.front && formData.verificationDocs?.selfie && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <ScanFace className="text-brand-600" size={20} />
                        Validación Biométrica
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">
                        Usaremos Inteligencia Artificial para confirmar que la persona en la selfie coincide con la cédula.
                    </p>
                    
                    {verificationResult && !verificationResult.match && (
                        <div className="mb-3 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100 flex items-start gap-2">
                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                            <span>{verificationResult.reason}</span>
                        </div>
                    )}

                    <Button 
                        fullWidth 
                        onClick={handleRunBiometricCheck} 
                        disabled={isVerifyingBiometrics}
                        variant="primary"
                    >
                        {isVerifyingBiometrics ? <Loader2 className="animate-spin" /> : 'Verificar Identidad Ahora'}
                    </Button>
                </div>
            )}
            
            {formData.isVerified && (
                <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 animate-in zoom-in">
                    <div className="bg-emerald-100 p-2 rounded-full text-emerald-600"><CheckCircle size={24} /></div>
                    <div>
                        <h4 className="font-bold text-emerald-800">Identidad Verificada</h4>
                        <p className="text-xs text-emerald-600">Documentos validados biométricamente.</p>
                    </div>
                </div>
            )}
         </div>
      </div>
    </div>
  );
};

const AddBankAccountPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const handleSave = () => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            navigate(-1);
        }, 1500);
    };

    return (
        <div className="pb-24 bg-white min-h-screen">
            <Header title="Agregar Cuenta" showBack />
            <div className="p-6">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6 flex gap-3">
                    <ShieldCheck className="text-blue-600 shrink-0" />
                    <p className="text-xs text-blue-700">Tus datos bancarios están encriptados y solo se usan para depositar tus ganancias.</p>
                </div>

                <InputGroup label="Banco">
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500">
                        <option>Bancolombia</option>
                        <option>Davivienda</option>
                        <option>Nequi</option>
                        <option>Daviplata</option>
                        <option>BBVA</option>
                    </select>
                </InputGroup>
                
                <InputGroup label="Tipo de Cuenta">
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500">
                        <option>Ahorros</option>
                        <option>Corriente</option>
                    </select>
                </InputGroup>

                <InputGroup label="Número de Cuenta">
                     <input type="tel" placeholder="0000000000" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500" />
                </InputGroup>

                <InputGroup label="Titular de la Cuenta">
                     <input type="text" placeholder="Nombre completo" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500" />
                </InputGroup>
                
                <InputGroup label="Cédula del Titular">
                     <input type="tel" placeholder="1234567890" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500" />
                </InputGroup>

                <div className="mt-8">
                    <Button fullWidth onClick={handleSave} disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : 'Guardar Cuenta'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

const WalletHistoryPage = () => {
    // Mock History
    const history = [
        { id: 1, type: 'deposit', amount: 450000, date: '2023-11-15', label: 'Renta Tesla Model 3', status: 'completed' },
        { id: 2, type: 'withdrawal', amount: 200000, date: '2023-11-10', label: 'Retiro a Bancolombia', status: 'completed' },
        { id: 3, type: 'deposit', amount: 380000, date: '2023-11-05', label: 'Renta Toyota Fortuner', status: 'completed' },
    ];

    return (
        <div className="pb-24 bg-white min-h-screen">
            <Header title="Historial de Transacciones" showBack />
            <div className="p-6">
                <div className="space-y-4">
                    {history.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                             <div className="flex items-center gap-3">
                                 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.type === 'deposit' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-600'}`}>
                                     {item.type === 'deposit' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                 </div>
                                 <div>
                                     <p className="font-bold text-slate-800 text-sm">{item.label}</p>
                                     <p className="text-xs text-slate-500">{item.date}</p>
                                 </div>
                             </div>
                             <div className="text-right">
                                 <span className={`block font-bold ${item.type === 'deposit' ? 'text-emerald-600' : 'text-slate-800'}`}>
                                     {item.type === 'deposit' ? '+' : '-'}{formatCOP(item.amount)}
                                 </span>
                                 <span className="text-[10px] uppercase font-bold text-slate-400">{item.status}</span>
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const MyVehiclesPage = ({ vehicles, bookings, onAddVehicle, onToggleAvailability }: { vehicles: Vehicle[], bookings: Booking[], onAddVehicle: (v: Vehicle) => void, onToggleAvailability: (id: string) => void }) => {
    const [view, setView] = useState<'list' | 'add'>('list');
    
    // Add Vehicle Form State
    const [newCarStep, setNewCarStep] = useState(1);
    const [newCarData, setNewCarData] = useState<Partial<Vehicle>>({
        features: {
            transmission: 'Automática',
            fuel: 'Gasolina',
            passengers: 5,
            hasAC: true,
            hasGPS: true,
            hasBluetooth: true,
            hasReverseCamera: false,
            hasAndroidAuto: false,
            hasSunroof: false,
            hasBabySeat: false,
            is4x4: false
        }
    });

    const myVehicles = vehicles.filter(v => v.ownerId === 'o1' || v.ownerId === 'current');

    const handleStepNext = () => setNewCarStep(prev => prev + 1);
    const handleStepBack = () => setNewCarStep(prev => prev - 1);
    
    const handleSubmitVehicle = () => {
        const vehicle: Vehicle = {
            ...newCarData as Vehicle,
            id: `v${Date.now()}`,
            ownerId: 'current',
            isAvailable: true,
            verificationStatus: 'verified', // Auto verify for demo
            imageUrl: newCarData.imageUrl || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80',
            location: newCarData.location || 'Bogotá', // Default
        };
        onAddVehicle(vehicle);
        setView('list');
        setNewCarStep(1);
        setNewCarData({
            features: {
                transmission: 'Automática',
                fuel: 'Gasolina',
                passengers: 5,
                hasAC: true,
                hasGPS: true,
                hasBluetooth: true,
                hasReverseCamera: false,
                hasAndroidAuto: false,
                hasSunroof: false,
                hasBabySeat: false,
                is4x4: false
            }
        }); 
    };

    if (view === 'list') {
        return (
            <div className="pb-24 bg-slate-50 min-h-screen">
                <Header title="Mis Vehículos" showBack />
                <div className="p-6">
                    {myVehicles.length === 0 ? (
                         <div className="text-center py-12">
                             <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                 <Car size={32} className="text-slate-400" />
                             </div>
                             <h3 className="text-slate-800 font-bold text-lg">No tienes vehículos</h3>
                             <p className="text-slate-500 text-sm mt-1 mb-6">Empieza a ganar dinero rentando tu auto.</p>
                             <Button onClick={() => setView('add')}>Agregar Vehículo</Button>
                         </div>
                    ) : (
                        <div className="space-y-4">
                            {myVehicles.map(v => (
                                <div key={v.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                                    <div className="flex gap-4">
                                        <div className="w-24 h-24 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                                            <img src={v.imageUrl} className="w-full h-full object-cover" alt="Car" />
                                        </div>
                                        <div className="flex-1 py-1">
                                            <div className="flex justify-between items-start">
                                                <h3 className="font-bold text-slate-900">{v.make} {v.model}</h3>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${v.isAvailable ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                        {v.isAvailable ? 'Activo' : 'Pausado'}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-500 mb-2">{v.year} • {v.location}</p>
                                            <p className="text-brand-600 font-bold text-sm">{formatCOP(v.pricePerDay)}/día</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                                        <button onClick={() => onToggleAvailability(v.id)} className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                            {v.isAvailable ? <ToggleRight size={24} className="text-emerald-500" /> : <ToggleLeft size={24} />}
                                            {v.isAvailable ? 'Disponible' : 'No disponible'}
                                        </button>
                                        <button className="text-xs font-bold text-brand-600">Editar</button>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => setView('add')} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-brand-300 hover:text-brand-600 transition-colors">
                                <Plus size={20} /> Agregar otro vehículo
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Add Vehicle Wizard
    return (
        <div className="pb-32 bg-white min-h-screen">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3 sticky top-0 bg-white z-40">
                <button onClick={() => { if(newCarStep > 1) handleStepBack(); else setView('list'); }} className="p-2 -ml-2 rounded-full hover:bg-slate-100">
                    <ArrowLeft size={24} className="text-slate-600" />
                </button>
                <div>
                    <h1 className="text-lg font-bold text-slate-800">Publicar Vehículo</h1>
                    <div className="flex gap-1 mt-1">
                        {[1, 2, 3].map(s => (
                            <div key={s} className={`h-1 w-8 rounded-full transition-colors ${newCarStep >= s ? 'bg-brand-600' : 'bg-slate-200'}`}></div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-6">
                {newCarStep === 1 && (
                    <div className="space-y-4 animate-in slide-in-from-right">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">Información Básica</h2>
                        <InputGroup label="Marca">
                            <select 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3"
                                onChange={(e) => setNewCarData({...newCarData, make: e.target.value})}
                                value={newCarData.make || ''}
                            >
                                <option value="">Seleccionar</option>
                                <option value="Chevrolet">Chevrolet</option>
                                <option value="Renault">Renault</option>
                                <option value="Mazda">Mazda</option>
                                <option value="Toyota">Toyota</option>
                                <option value="Kia">Kia</option>
                            </select>
                        </InputGroup>
                        <InputGroup label="Modelo">
                            <input type="text" placeholder="Ej. Spark GT" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3" 
                                onChange={(e) => setNewCarData({...newCarData, model: e.target.value})}
                                value={newCarData.model || ''}
                            />
                        </InputGroup>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <InputGroup label="Año">
                                    <input type="number" placeholder="2020" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3" 
                                        onChange={(e) => setNewCarData({...newCarData, year: parseInt(e.target.value)})}
                                        value={newCarData.year || ''}
                                    />
                                </InputGroup>
                            </div>
                            <div className="flex-1">
                                <InputGroup label="Categoría">
                                    <select 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3"
                                        onChange={(e) => setNewCarData({...newCarData, category: e.target.value as VehicleCategory})}
                                        value={newCarData.category || ''}
                                    >
                                        <option value="">Sel.</option>
                                        {Object.values(VehicleCategory).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </InputGroup>
                            </div>
                        </div>
                        <InputGroup label="Ubicación (Ciudad)">
                             <select 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3"
                                onChange={(e) => setNewCarData({...newCarData, location: e.target.value})}
                                value={newCarData.location || ''}
                            >
                                <option value="">Seleccionar</option>
                                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </InputGroup>
                        <InputGroup label="Precio por día (COP)">
                            <input type="number" placeholder="Ej. 150000" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-brand-600" 
                                onChange={(e) => setNewCarData({...newCarData, pricePerDay: parseInt(e.target.value)})}
                                value={newCarData.pricePerDay || ''}
                            />
                        </InputGroup>
                    </div>
                )}

                {newCarStep === 2 && (
                    <div className="space-y-4 animate-in slide-in-from-right">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">Fotos del Vehículo</h2>
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl mb-4 text-xs text-blue-700 flex items-start gap-2">
                            <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                            <p>Nuestra Inteligencia Artificial verificará que las fotos correspondan a un vehículo real.</p>
                        </div>
                        <ImageUploadBox 
                            label="Foto Principal" 
                            image={newCarData.imageUrl} 
                            onImageSelect={(url) => setNewCarData({...newCarData, imageUrl: url})}
                            required
                            validationType="vehicle"
                        />
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <ImageUploadBox label="Lateral" onImageSelect={() => {}} validationType="vehicle" />
                            <ImageUploadBox label="Trasera" onImageSelect={() => {}} validationType="vehicle" />
                            <ImageUploadBox label="Interior" onImageSelect={() => {}} validationType="vehicle" />
                            <ImageUploadBox label="Maletero" onImageSelect={() => {}} validationType="vehicle" />
                        </div>
                    </div>
                )}

                {newCarStep === 3 && (
                    <div className="space-y-4 animate-in slide-in-from-right">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">Características</h2>
                        <div className="grid grid-cols-2 gap-4">
                             <div 
                                onClick={() => setNewCarData({ ...newCarData, features: { ...newCarData.features!, transmission: 'Automática' } })}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 cursor-pointer transition-colors ${newCarData.features?.transmission === 'Automática' ? 'border-brand-500 bg-brand-50' : 'border-slate-100'}`}
                             >
                                 <Settings size={24} />
                                 <span className="text-xs font-bold">Automática</span>
                             </div>
                             <div 
                                onClick={() => setNewCarData({ ...newCarData, features: { ...newCarData.features!, transmission: 'Manual' } })}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 cursor-pointer transition-colors ${newCarData.features?.transmission === 'Manual' ? 'border-brand-500 bg-brand-50' : 'border-slate-100'}`}
                             >
                                 <Settings size={24} />
                                 <span className="text-xs font-bold">Manual</span>
                             </div>
                        </div>

                        <div className="space-y-2 pt-4">
                            <h3 className="font-bold text-sm text-slate-700">Equipamiento</h3>
                            {[
                                { k: 'hasAC', l: 'Aire Acondicionado', i: Wind },
                                { k: 'hasGPS', l: 'GPS', i: MapPin },
                                { k: 'hasBluetooth', l: 'Bluetooth', i: Bluetooth },
                                { k: 'hasReverseCamera', l: 'Cámara Reversa', i: Video },
                            ].map((item) => (
                                <div key={item.k} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-600">
                                            <item.i size={16} />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700">{item.l}</span>
                                    </div>
                                    <button 
                                        onClick={() => setNewCarData({ ...newCarData, features: { ...newCarData.features!, [item.k]: !newCarData.features![item.k as keyof typeof newCarData.features] } })}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${newCarData.features![item.k as keyof typeof newCarData.features] ? 'bg-brand-600' : 'bg-slate-300'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-1 transition-transform ${newCarData.features![item.k as keyof typeof newCarData.features] ? 'left-6' : 'left-1'}`}></div>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-5 bg-white border-t border-slate-100 z-[60]">
                <Button fullWidth onClick={newCarStep === 3 ? handleSubmitVehicle : handleStepNext}>
                    {newCarStep === 3 ? 'Publicar Vehículo' : 'Siguiente'}
                </Button>
            </div>
        </div>
    );
};

const App = () => {
    const [vehicles, setVehicles] = useState<Vehicle[]>(MOCK_VEHICLES);
    const [bookings, setBookings] = useState<Booking[]>(MOCK_BOOKINGS);
    const [filterContext, setFilterContext] = useState({ city: 'Bogotá', startDate: '', endDate: '' });
    
    // Mock User
    const [user, setUser] = useState<UserType & { isVerified: boolean, verificationDocs: any, email: string, phone: string }>({
        id: 'u1',
        name: 'Juan Pérez',
        cedula: '1234567890',
        dob: '1990-01-01',
        walletBalance: 2500000,
        role: 'renter',
        isVerified: false,
        verificationDocs: {},
        email: 'juan@example.com',
        phone: '3001234567'
    });
    const [userCredits, setUserCredits] = useState(150000);

    const handleBook = (vehicle: Vehicle, creditDeduction: number) => {
        const newBooking: Booking = {
            id: `b${Date.now()}`,
            vehicleId: vehicle.id,
            renterId: user.id,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            totalPrice: vehicle.pricePerDay,
            status: BookingStatus.CONFIRMED,
            vehicleSnapshot: vehicle
        };
        setBookings([...bookings, newBooking]);
        if (creditDeduction > 0) {
            setUserCredits(prev => Math.max(0, prev - creditDeduction));
        }
        alert('Reserva exitosa!');
    };

    const handleAddReview = (id: string, rating: number, comment: string) => {
        setBookings(bookings.map(b => 
            b.id === id ? { ...b, review: { rating, comment, createdAt: new Date().toISOString() } } : b
        ));
    };

    const handleUpdateStatus = (id: string, status: BookingStatus) => {
        setBookings(bookings.map(b => b.id === id ? { ...b, status } : b));
    };

    const handleCancelBooking = (id: string) => {
        const booking = bookings.find(b => b.id === id);
        if (booking) {
            const refundAmount = booking.totalPrice * 0.9;
            setUserCredits(prev => prev + refundAmount);
        }
        handleUpdateStatus(id, BookingStatus.CANCELLED);
    };

    const handleAddVehicle = (vehicle: Vehicle) => {
        setVehicles([...vehicles, vehicle]);
    };

    const handleToggleAvailability = (id: string) => {
        setVehicles(vehicles.map(v => v.id === id ? { ...v, isAvailable: !v.isAvailable } : v));
    };
    
    const handleUpdateUser = (updatedUser: any) => {
        setUser(updatedUser);
    };

    return (
        <Router>
            <div className="max-w-md mx-auto bg-slate-50 min-h-screen shadow-2xl overflow-hidden relative font-sans text-slate-900">
                <Routes>
                    <Route path="/" element={<HomePage setFilterContext={setFilterContext} vehicles={vehicles} />} />
                    <Route path="/search" element={<SearchPage vehicles={vehicles} filterContext={filterContext} />} />
                    <Route path="/vehicle/:id" element={<VehicleDetailPage vehicles={vehicles} userCredits={userCredits} onBook={handleBook} />} />
                    <Route path="/reservations" element={<ReservationsPage bookings={bookings} onAddReview={handleAddReview} onUpdateStatus={handleUpdateStatus} onCancelBooking={handleCancelBooking} />} />
                    <Route path="/profile" element={<ProfilePage walletBalance={user.walletBalance} userCredits={userCredits} user={user} />} />
                    <Route path="/personal-info" element={<PersonalInfoPage user={user} onUpdateUser={handleUpdateUser} />} />
                    <Route path="/add-account" element={<AddBankAccountPage />} />
                    <Route path="/withdraw" element={<WalletHistoryPage />} />
                    <Route path="/my-vehicles" element={<MyVehiclesPage vehicles={vehicles} bookings={bookings} onAddVehicle={handleAddVehicle} onToggleAvailability={handleToggleAvailability} />} />
                    <Route path="*" element={<div className="p-6">Page not found</div>} />
                </Routes>
                <BottomNav />
            </div>
        </Router>
    );
};

export default App;