export enum VehicleCategory {
  LUXURY = 'Luxury',
  ELECTRIC = 'Eléctricos',
  SUV = 'SUV',
  STANDARD = 'Estándar',
  MOTORCYCLE = 'Motos'
}

export enum BookingStatus {
  PENDING = 'Pendiente',
  CONFIRMED = 'Confirmada',
  IN_PROGRESS = 'En curso',
  FINISHED = 'Finalizada',
  CANCELLED = 'Cancelada'
}

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface Vehicle {
  id: string;
  ownerId: string;
  make: string;
  model: string;
  year: number;
  category: VehicleCategory;
  pricePerDay: number;
  imageUrl: string; // Main thumbnail
  location: string;
  isAvailable: boolean;
  verificationStatus: VerificationStatus; // New field for approval process
  features: {
    transmission: 'Automática' | 'Manual';
    fuel: 'Gasolina' | 'Diésel' | 'Eléctrico';
    passengers: number;
    // New detailed features
    hasAC: boolean;
    hasGPS: boolean;
    hasBluetooth: boolean;
    hasReverseCamera: boolean;
    hasAndroidAuto: boolean; // Covers CarPlay too
    hasSunroof: boolean;
    hasBabySeat: boolean;
    is4x4: boolean;
  };
  discounts?: {
    weekly: number;   // % off for 7+ days
    biweekly: number; // % off for 15+ days
    monthly: number;  // % off for 30+ days
  };
  // Step 2 Verification Data
  verification?: {
    documents: {
      ownershipCard: string; // URL
      soat: string; // URL
    };
    gallery: {
      front: string;
      back: string;
      sideRight: string;
      sideLeft: string;
      interiorDashboard: string;
      interiorSeats: string;
    };
  };
}

export interface Booking {
  id: string;
  vehicleId: string;
  renterId: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: BookingStatus;
  vehicleSnapshot: Vehicle; // Store snapshot in case vehicle changes
  review?: {
    rating: number;
    comment: string;
    createdAt: string;
  };
}

export interface User {
  id: string;
  name: string;
  cedula: string;
  dob: string;
  walletBalance: number;
  role: 'renter' | 'owner'; // Simplified for prototype
}