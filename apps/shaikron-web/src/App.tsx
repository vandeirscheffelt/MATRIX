import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProfessionalsProvider } from "@/contexts/ProfessionalsContext";
import { PricingProvider } from "@/contexts/PricingContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProductsProvider } from "@/contexts/ProductsContext";
import { ModulesProvider } from "@/contexts/ModulesContext";
import { AffiliatesProvider } from "@/contexts/AffiliatesContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import AgendaPage from "./pages/AgendaPage.tsx";
import ConversationsPage from "./pages/ConversationsPage.tsx";
import OnboardingPage from "./pages/OnboardingPage.tsx";
import AccountPage from "./pages/AccountPage.tsx";
import AdminPage from "./pages/AdminPage.tsx";
import ProductsManagerPage from "./pages/ProductsManagerPage.tsx";
import OtherProductsPage from "./pages/OtherProductsPage.tsx";
import ModulesManagerPage from "./pages/ModulesManagerPage.tsx";
import OtherModulesPage from "./pages/OtherModulesPage.tsx";
import AffiliatesPage from "./pages/AffiliatesPage.tsx";
import AffiliatesManagerPage from "./pages/AffiliatesManagerPage.tsx";
import TutorialsPage from "./pages/TutorialsPage.tsx";
import TutorialsManagerPage from "./pages/TutorialsManagerPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import SignupPage from "./pages/SignupPage.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";
import BillingSuccessPage from "./pages/BillingSuccessPage.tsx";
import BillingCancelPage from "./pages/BillingCancelPage.tsx";
import PacientesPage from "./pages/PacientesPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <LanguageProvider>
        <ProfessionalsProvider>
          <PricingProvider>
            <ProductsProvider>
            <ModulesProvider>
            <AffiliatesProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                  <Route path="/agenda" element={<ProtectedRoute><AgendaPage /></ProtectedRoute>} />
                  <Route path="/conversations" element={<ProtectedRoute><ConversationsPage /></ProtectedRoute>} />
                  <Route path="/crm" element={<ProtectedRoute><PacientesPage /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
                  <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
                  <Route path="/admin/products" element={<ProtectedRoute adminOnly><ProductsManagerPage /></ProtectedRoute>} />
                  <Route path="/admin/modules" element={<ProtectedRoute adminOnly><ModulesManagerPage /></ProtectedRoute>} />
                  <Route path="/admin/affiliates" element={<ProtectedRoute adminOnly><AffiliatesManagerPage /></ProtectedRoute>} />
                  <Route path="/admin/tutorials" element={<ProtectedRoute adminOnly><TutorialsManagerPage /></ProtectedRoute>} />
                  <Route path="/modules" element={<ProtectedRoute><OtherModulesPage /></ProtectedRoute>} />
                  <Route path="/affiliates" element={<ProtectedRoute><AffiliatesPage /></ProtectedRoute>} />
                  <Route path="/tutorials" element={<ProtectedRoute><TutorialsPage /></ProtectedRoute>} />
                  <Route path="/products" element={<ProtectedRoute><OtherProductsPage /></ProtectedRoute>} />
                  <Route path="/billing/success" element={<ProtectedRoute><BillingSuccessPage /></ProtectedRoute>} />
                  <Route path="/billing/cancel" element={<ProtectedRoute><BillingCancelPage /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </AffiliatesProvider>
            </ModulesProvider>
            </ProductsProvider>
          </PricingProvider>
        </ProfessionalsProvider>
        </LanguageProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
