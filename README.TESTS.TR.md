# Entegrasyon Test Özeti (TR)

Bu doküman, son çalýþtýrmada geçen entegrasyon testlerinin neyi doðruladýðýný kýsa þekilde özetler.

## 1) Web Tarafý (`bitirme-web`)

### `tests/integration/queue.integration.test.js`

- `TC-IT-01 Carrier -> Backend -> Operator`
  - Taþýyýcýnýn kuyruða giriþi sonrasý kaydýn oluþturulmasý ve operatör listesinde doðru sýrada görünmesi doðrulanýr.

- `TC-IT-02 Operator -> Backend -> Carrier`
  - Operatör servis baþlatýp tamamladýðýnda, aktif kuyruktan kaydýn düþmesi doðrulanýr.

- `TC-IT-03 Operator -> Backend -> Carrier`
  - No-show / iptal iþleminden sonra kaydýn aktif kuyrukta kalmamasý doðrulanýr.

- `TC-IT-04 Invalid state transitions`
  - Geçersiz durum geçiþlerinin (ör. yanlýþ sýrada complete/start) backend tarafýndan engellenmesi doðrulanýr.

- `TC-IT-05 Çoklu taþýyýcý sýrasý`
  - Birden çok taþýyýcýnýn kuyrukta doðru sýra ile listelenmesi doðrulanýr.

### `tests/integration/issue.integration.test.js`

- `TC-IR-01 Operator -> Backend(Admin)`
  - Geçerli issue kaydýnýn kullanýcý, istasyon ve zaman bilgileriyle oluþturulmasý doðrulanýr.

- `TC-IR-02 Backend(Admin) -> Admin Panel`
  - Issue kaydýnýn admin tarafýnda görünmesi ve aranabilir olmasý doðrulanýr.

- `TC-IR-03 Admin -> Backend -> Operator`
  - Admin "çözüldü" yaptýðýnda status ve zaman bilgisinin doðru güncellenmesi doðrulanýr.

- `TC-IR-04 Invalid issue submission`
  - Geçersiz issue gönderimlerinin doðrulama hatasý döndürmesi ve kayýt oluþturmamasý doðrulanýr.

## 2) Mobil Tarafý (`arrivio`)

### `npm run test:integration:api`
Dosya: `tests/contracts/queue-contract.integration.test.cjs`

- Queue endpoint sözleþmeleri (request/response schema) doðrulanýr.
- Canlý modda (`RUN_QUEUE_CONTRACT_LIVE=1`) queue fonksiyon akýþlarý uçtan uca API seviyesinde doðrulanýr:
  - `enterQueue`
  - `getStationQueue`
  - `startService`
  - `completeService`
  - `cancelQueueEntry`

### `npm run test:integration:data`
Dosya: `tests/integration/carrierFlow.integration.test.cjs`

- Firestore veri katmaný davranýþý doðrulanýr (mobil bakýþ açýsýndan):
  - Kayýt yazma/güncelleme
  - Queue görünürlüðü ve arama
  - Durum güncellemesinin kalýcýlýðý
  - Geçersiz payload’ýn kayýt oluþturmamasý

## 3) Sonuç

Son çalýþtýrmada aþaðýdaki test gruplarý baþarýlý geçmiþtir:

- Web Queue Integration: **5/5 PASS**
- Web Issue Integration: **4/4 PASS**
- Mobil Queue API Integration: **7/7 PASS**
- Mobil Firestore Data Integration: **4/4 PASS**

Bu sonuç, queue ve issue akýþlarýnda backend + veritabaný + istemci doðrulamalarýnýn beklenen þekilde çalýþtýðýný gösterir.
