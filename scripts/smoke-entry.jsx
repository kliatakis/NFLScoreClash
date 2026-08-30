// Entry point for the smoke test (scripts/smoke.mjs).
//
// Importing a module EVALUATES it, which is what catches a file referencing an
// identifier nobody imported. Exporting the components lets the smoke test
// render each one and catch anything that throws on the way to first paint.
//
// Every component belongs in here. If you add one and forget, it simply isn't
// covered — so the list is deliberately exhaustive rather than clever.
export { default as App } from "../src/App.jsx";
export { default as AdminPanel } from "../src/components/AdminPanel.jsx";
export { default as AppHealthPanel } from "../src/components/AppHealthPanel.jsx";
export { default as AuthPage } from "../src/components/AuthPage.jsx";
export { default as Avatar } from "../src/components/Avatar.jsx";
export { default as AwardsCard } from "../src/components/AwardsCard.jsx";
export { default as BackupPanel } from "../src/components/BackupPanel.jsx";
export { default as ConfirmDialog } from "../src/components/ConfirmDialog.jsx";
export { default as DashboardTab } from "../src/components/DashboardTab.jsx";
export { default as ErrorBoundary } from "../src/components/ErrorBoundary.jsx";
export { default as Footer } from "../src/components/Footer.jsx";
export { default as HeadToHeadCard } from "../src/components/HeadToHeadCard.jsx";
export { default as HighlightsCard } from "../src/components/HighlightsCard.jsx";
export { default as HistoryPanel } from "../src/components/HistoryPanel.jsx";
export { default as HowItWorks } from "../src/components/HowItWorks.jsx";
export { default as LeaguesTab } from "../src/components/LeaguesTab.jsx";
export { default as MovementArrows } from "../src/components/MovementArrows.jsx";
export { default as NflStandingsTab } from "../src/components/NflStandingsTab.jsx";
export { default as Podium } from "../src/components/Podium.jsx";
export { default as PredictionsTab } from "../src/components/PredictionsTab.jsx";
export { default as ProfileDropdown } from "../src/components/ProfileDropdown.jsx";
export { default as SeasonChartCard } from "../src/components/SeasonChartCard.jsx";
export { default as SeasonCountdown } from "../src/components/SeasonCountdown.jsx";
export { default as StandingsCard } from "../src/components/StandingsCard.jsx";
export { default as TeamBadge } from "../src/components/TeamBadge.jsx";
export { default as VerifyEmailBanner } from "../src/components/VerifyEmailBanner.jsx";
export { default as WeeklyStandingsCard } from "../src/components/WeeklyStandingsCard.jsx";
export { HexIcon, WordmarkLogo, LogoIntro } from "../src/components/Logo.jsx";
