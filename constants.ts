import { Vehicle, VehicleCategory, BookingStatus, Booking } from './types';

export const MOCK_VEHICLES: Vehicle[] = [
  {
    id: 'v1',
    ownerId: 'o1',
    make: 'Tesla',
    model: 'Model 3',
    year: 2023,
    category: VehicleCategory.ELECTRIC,
    pricePerDay: 450000,
    imageUrl: 'https://images.unsplash.com/photo-1536700503339-1e4b06520771?auto=format&fit=crop&w=800&q=80',
    location: 'Bogotá',
    isAvailable: true,
    verificationStatus: 'verified',
    features: {
      transmission: 'Automática',
      fuel: 'Eléctrico',
      passengers: 5,
      hasAC: true,
      hasGPS: true,
      hasBluetooth: true,
      hasReverseCamera: true,
      hasAndroidAuto: true,
      hasSunroof: true,
      hasBabySeat: true,
      is4x4: false
    },
    discounts: {
      weekly: 10,
      biweekly: 15,
      monthly: 25
    }
  },
  {
    id: 'v2',
    ownerId: 'o2',
    make: 'Toyota',
    model: 'Fortuner',
    year: 2022,
    category: VehicleCategory.SUV,
    pricePerDay: 380000,
    imageUrl: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&q=80',
    location: 'Medellín',
    isAvailable: true,
    verificationStatus: 'verified',
    features: {
      transmission: 'Automática',
      fuel: 'Gasolina',
      passengers: 7,
      hasAC: true,
      hasGPS: true,
      hasBluetooth: true,
      hasReverseCamera: true,
      hasAndroidAuto: true,
      hasSunroof: false,
      hasBabySeat: false,
      is4x4: true
    },
    discounts: {
      weekly: 5,
      biweekly: 10,
      monthly: 20
    }
  },
  {
    id: 'v3',
    ownerId: 'o3',
    make: 'BMW',
    model: 'S1000RR',
    year: 2021,
    category: VehicleCategory.MOTORCYCLE,
    pricePerDay: 200000,
    imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    location: 'Cali',
    isAvailable: true,
    verificationStatus: 'verified',
    features: {
      transmission: 'Manual',
      fuel: 'Gasolina',
      passengers: 2,
      hasAC: false,
      hasGPS: false,
      hasBluetooth: false,
      hasReverseCamera: false,
      hasAndroidAuto: false,
      hasSunroof: false,
      hasBabySeat: false,
      is4x4: false
    }
  },
  {
    id: 'v4',
    ownerId: 'o1',
    make: 'Mazda',
    model: '3',
    year: 2020,
    category: VehicleCategory.STANDARD,
    pricePerDay: 180000,
    imageUrl: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=800&q=80',
    location: 'Bogotá',
    isAvailable: true,
    verificationStatus: 'verified',
    features: {
      transmission: 'Automática',
      fuel: 'Gasolina',
      passengers: 5,
      hasAC: true,
      hasGPS: true,
      hasBluetooth: true,
      hasReverseCamera: true,
      hasAndroidAuto: true,
      hasSunroof: true,
      hasBabySeat: true,
      is4x4: false
    },
    discounts: {
      weekly: 10,
      biweekly: 15,
      monthly: 30
    }
  }
];

export const MOCK_BOOKINGS: Booking[] = [
  {
    id: 'b1',
    vehicleId: 'v2',
    renterId: 'current',
    startDate: '2023-11-10',
    endDate: '2023-11-15',
    totalPrice: 1900000,
    status: BookingStatus.CONFIRMED,
    vehicleSnapshot: MOCK_VEHICLES[1]
  },
  {
    id: 'b2',
    vehicleId: 'v4',
    renterId: 'current',
    startDate: '2023-12-01',
    endDate: '2023-12-05',
    totalPrice: 720000,
    status: BookingStatus.PENDING,
    vehicleSnapshot: MOCK_VEHICLES[3]
  }
];

export const CITIES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena'];