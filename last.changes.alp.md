# Last Changes

This file summarizes the latest changes that were restored and applied to the project.

## 1. UI and Web Stability

### English

- `app/_layout.tsx`
  Improved the web startup flow by softening splash and font-loading behavior.
  Adjusted the boot screen shown during the auth `checking` state and separated the web splash behavior from the native flow.

- `metro.config.js`
  Added a Metro `blockList` so non-application files such as `firestore.rules`, `firebase.json`, `.firebaserc`, `functions/`, and local log files do not trigger unnecessary reloads during web development.

- `app/(tabs)/home/index.tsx`
  Fixed the `Platform is not defined` runtime issue and cleaned up some web-specific prop and style warnings.

- `app/(tabs)/pulse/index.tsx`
  Removed deprecated style usage that was causing warnings on web.

- `app/(auth)/login.tsx`
  Cleaned up web-specific warning cases.

- `app/(auth)/register.tsx`
  Cleaned up web-specific warning cases.

- `app/(auth)/forgot-password.tsx`
  Cleaned up web-specific warning cases.

- `components/gradient-button.tsx`
  Cleaned up web-related warning cases in the shared button component.

### Turkish

- `app/_layout.tsx`
  Web açılış akışını iyileştirdim; splash ve font bekleme davranışını daha yumuşak hale getirdim.
  Auth `checking` durumunda görünen boot ekranını düzenledim ve web splash davranışını native akıştan ayırdım.

- `metro.config.js`
  `firestore.rules`, `firebase.json`, `.firebaserc`, `functions/` ve local log dosyaları gibi uygulama dışı dosyaların web tarafında gereksiz reload tetiklemesini önlemek için Metro `blockList` ekledim.

- `app/(tabs)/home/index.tsx`
  `Platform is not defined` hatasını düzelttim ve web tarafındaki bazı prop/style warning’lerini temizledim.

- `app/(tabs)/pulse/index.tsx`
  Web tarafında warning oluşturan deprecated style kullanımını temizledim.

- `app/(auth)/login.tsx`
  Web’e özel warning durumlarını temizledim.

- `app/(auth)/register.tsx`
  Web’e özel warning durumlarını temizledim.

- `app/(auth)/forgot-password.tsx`
  Web’e özel warning durumlarını temizledim.

- `components/gradient-button.tsx`
  Ortak button bileşenindeki web kaynaklı warning durumlarını temizledim.

## 2. Booking and Auth Flow

### English

- `src/api/bookings.ts`
  Made booking operations more resilient when Firebase auth restores late by waiting briefly for the user session before proceeding.
  This prevents actions such as booking cancellation from failing only because auth was not ready yet.

- `app/(tabs)/bookings/[id].tsx`
  Restored web cancellation using the browser confirmation flow.
  Also hid management actions for bookings that are already `cancelled` or `completed`.

- `app/(tabs)/bookings/new.tsx`
  Fixed misleading wait-time rendering such as invalid `0.00 min` displays.
  Improved best-station selection handling and restored booking wait-time localization behavior.

- `locales/en/booking.json`
  Added the booking wait-time and fallback copy used by the updated booking flow.

- `locales/tr/booking.json`
  Added the Turkish booking wait-time and fallback copy used by the updated booking flow.

- `firestore.rules`
  Updated booking rules so the booking owner can safely cancel a booking by changing only the intended fields.

### Turkish

- `src/api/bookings.ts`
  Firebase auth geç yüklenirse booking işlemlerinin hemen düşmemesi için kullanıcı oturumunu kısa süre bekleyen daha dayanıklı bir akış ekledim.
  Böylece özellikle booking cancel gibi işlemler, sadece auth hazır değil diye hata vermiyor.

- `app/(tabs)/bookings/[id].tsx`
  Web tarafında iptal akışını browser confirm penceresi ile geri ekledim.
  Ayrıca `cancelled` ve `completed` durumundaki booking’lerde yönetim aksiyonlarını gizledim.

- `app/(tabs)/bookings/new.tsx`
  Hatalı veya yanıltıcı `0.00 dk` bekleme göstergelerini düzelttim.
  En iyi istasyon seçimi mantığını iyileştirdim ve booking bekleme metinlerinin lokalizasyon davranışını geri ekledim.

- `locales/en/booking.json`
  Güncellenen booking akışında kullanılan bekleme süresi ve fallback metinlerini ekledim.

- `locales/tr/booking.json`
  Güncellenen booking akışında kullanılan Türkçe bekleme süresi ve fallback metinlerini ekledim.

- `firestore.rules`
  Booking owner’ın sadece gerekli alanları değiştirerek güvenli şekilde iptal yapabilmesi için kuralları güncelledim.

## 3. Issue and Attach Photo Flow

### English

- `app/(tabs)/issues/index.tsx`
  Restored the real attach-photo flow by connecting the button to the image picker.
  Added preview and remove actions before submission.

- `src/api/issues.ts`
  Restored the issue photo upload flow by uploading selected images to Firebase Storage and saving the resulting URL into the issue document.
  Also improved auth readiness handling before performing issue actions.

- `src/services/firebase.ts`
  Added and exported Firebase Storage from the shared Firebase service.

- `locales/en/issue.json`
  Added English copy for photo actions such as `change photo`, `remove photo`, `photo attached`, and related permission or error messages.

- `locales/tr/issue.json`
  Restored and cleaned up the Turkish issue copy for the same photo-related actions and messages.

- `app.json`
  Registered the `expo-image-picker` plugin in the Expo configuration.

- `firebase.json`
  Added the Storage rules file to the Firebase configuration.

- `storage.rules`
  Added Storage rules for `issue-photos/{userId}/...` so authenticated users can read files and only the owner can upload to their own path.

### Turkish

- `app/(tabs)/issues/index.tsx`
  `Attach photo` butonunu gerçek image picker akışına bağladım.
  Gönderim öncesinde önizleme ve kaldırma işlemlerini ekledim.

- `src/api/issues.ts`
  Seçilen görselleri Firebase Storage’a yükleyip oluşan URL’yi issue dokümanına yazan akışı geri ekledim.
  Ayrıca issue işlemleri öncesinde auth hazır olma kontrolünü güçlendirdim.

- `src/services/firebase.ts`
  Ortak Firebase servisinden Firebase Storage export’unu ekledim.

- `locales/en/issue.json`
  `change photo`, `remove photo`, `photo attached` ve ilgili izin/hata mesajları için İngilizce metinleri ekledim.

- `locales/tr/issue.json`
  Aynı fotoğraf akışına ait Türkçe metinleri geri ekleyip düzenledim.

- `app.json`
  Expo config içine `expo-image-picker` plugin kaydını ekledim.

- `firebase.json`
  Firebase config içine Storage rules dosyasını ekledim.

- `storage.rules`
  `issue-photos/{userId}/...` yolu için, giriş yapmış kullanıcıların okuma yapabildiği ve sadece dosya sahibinin kendi alanına upload yapabildiği Storage kurallarını ekledim.
