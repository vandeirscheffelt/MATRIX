import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";

const mockUseAuth = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderProtectedRoute(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route path="/login" element={<div>Login</div>} />
        <Route path="/settings" element={<div>Settings</div>} />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <div>Protected content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it.each(["/", "/agenda", "/conversations", "/modules", "/products"])(
    "permite novo usuário acessar a rota %s",
    (pathname) => {
      mockUseAuth.mockReturnValue({
        isLoggedIn: true,
        isNewUser: true,
        isAdmin: false,
      });

      renderProtectedRoute(pathname);

      expect(screen.getByText("Protected content")).toBeInTheDocument();
    }
  );

  it("redireciona novo usuário para settings em rotas não liberadas", () => {
    mockUseAuth.mockReturnValue({
      isLoggedIn: true,
      isNewUser: true,
      isAdmin: false,
    });

    renderProtectedRoute("/admin");

    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});