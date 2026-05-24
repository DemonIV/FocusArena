# FocusArena 🎯

Rekabetçi bir odaklanma ve verimlilik uygulaması. Pomodoro zamanlayıcı, liderlik tabloları, arkadaşlık sistemi ve çalışma odaları ile çalışmayı bir oyuna dönüştür.

## Teknoloji Yığını

### Backend
- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Fastify
- **Veritabanı**: Supabase (PostgreSQL)
- **Cache / Queue**: Redis (Upstash) + Bull
- **Gerçek Zamanlı**: Socket.io
- **Deploy**: Fly.io (Amsterdam)

### Mobile
- **Framework**: React Native + Expo
- **State**: Zustand + MMKV
- **API**: TanStack Query

## Monorepo Yapısı

```
FocusArena/
├── backend/      # Fastify API sunucusu
├── mobile/       # React Native / Expo uygulaması
└── shared/       # Ortak TypeScript tipleri
```

## Özellikler

- 🕐 **Pomodoro Zamanlayıcı** — XP ve streak sistemi
- 🏆 **Liderlik Tablosu** — Gerçek zamanlı sıralama
- 🚪 **Çalışma Odaları** — Davet kodu ile birlikte çalış
- 👥 **Arkadaşlık Sistemi** — Arkadaş ekle, durumları takip et
- 🏅 **Başarımlar** — 10 farklı rozet
- ⚡ **Gerçek Zamanlı** — Socket.io ile anlık güncellemeler

## Geliştirme

```bash
# Bağımlılıkları yükle
npm install

# Backend geliştirme sunucusu
npm run backend:dev

# Mobile uygulama
cd mobile && npx expo start
```

## Deploy

Backend Fly.io üzerinde çalışmaktadır. `main` branch'e her push yapıldığında otomatik deploy tetiklenir.
