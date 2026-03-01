// constants/images.ts
// Keep filenames with spaces exactly as-is in require paths.

export const images = {
  // Settings / UI
  accountSettings: require('../assets/images/Account settings.png'),
  inbox: require('../assets/images/Inbox.png'),
  chat: require('../assets/images/Chat.png'),
  clock: require('../assets/images/Clock.png'),
  calendar: require('../assets/images/CALENDAR.png'),
  calculator: require('../assets/images/CALCULATOR.png'),
  briefcase: require('../assets/images/BRIEFCASE.png'),
  arrow: require('../assets/images/ARROW.png'),
  houseIcon: require('../assets/images/House Icon.png'),
  globe: require('../assets/images/Globe.png'),
  location: require('../assets/images/LOCATION.png'),
  lock: require('../assets/images/LOCK.png'),
  shield: require('../assets/images/SHIELD.png'),
  user: require('../assets/images/USER.png'),
  key: require('../assets/images/Key.png'),
  wallet: require('../assets/images/Wallet.png'),
  watch: require('../assets/images/WATCH.png'),

  // Devices / Props
  camera: require('../assets/images/Camera.png'),
  cellphone: require('../assets/images/Cellphone.png'),
  coffeeCup: require('../assets/images/Coffee Cup.png'),
  hourglass: require('../assets/images/Hourglass.png'),

  // Charts / Analytics
  analyticalChart: require('../assets/images/Analytical chart.png'),
  charts: require('../assets/images/Charts.png'),
  pieChart: require('../assets/images/Pie Chart.png'),
  performanceGrowth: require('../assets/images/Performance growth.png'),
  financialReport: require('../assets/images/Financial report.png'),
  statistics: require('../assets/images/STATISTICS.png'),

  // Map / Pins / Tags
  pin: require('../assets/images/Pin.png'),
  priceTag: require('../assets/images/Price Tag.png'),

  // Hands / Illustration assets
  callMeLeftHand: require('../assets/images/Call Me Left Hand.png'),
  callMeRightHand: require('../assets/images/Call Me Right Hand.png'),
  okLeftHand: require('../assets/images/Ok Left Hand.png'),
  pointingDownLeftHand: require('../assets/images/Pointing Down Left Hand.png'),
  scrollingPhoneRightHand: require('../assets/images/Scrolling Phone with Right Hand.png'),
  selfieRightHand: require('../assets/images/Selfie Right Hand.png'),
  thumbsUpRightHand: require('../assets/images/Thumbs Up Right Hand.png'),
  holdingTabletLeft: require('../assets/images/Holding a Tablet to the Left.png'),

  // PDFs (kept as assets)
  licensePdf: require('../assets/images/License.pdf'),
  license2Pdf: require('../assets/images/License2.pdf'),

  // Alerts
  alarm: require('../assets/images/Alarm.png'),
} as const;

export type ImageKey = keyof typeof images;
