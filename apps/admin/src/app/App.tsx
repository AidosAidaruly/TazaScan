import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom'
import { AuthProvider } from '../core/auth/auth-context'
import { ProtectedRoute } from '../core/router/ProtectedRoute'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { CreateProductPage } from '../features/products/pages/CreateProductPage'
import { EditProductPage } from '../features/products/pages/EditProductPage'
import { ProductDetailsPage } from '../features/products/pages/ProductDetailsPage'
import { ProductsListPage } from '../features/products/pages/ProductsListPage'
import { AppLayout } from '../shared/components/AppLayout'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Switch>
          <Route path="/login" exact component={LoginPage} />
          <ProtectedRoute>
            <AppLayout>
              <Switch>
                <Route path="/" exact>
                  <Redirect to="/products" />
                </Route>
                <Route path="/products" exact component={ProductsListPage} />
                <Route path="/products/new" exact component={CreateProductPage} />
                <Route path="/products/:id/edit" exact component={EditProductPage} />
                <Route path="/products/:id" exact component={ProductDetailsPage} />
              </Switch>
            </AppLayout>
          </ProtectedRoute>
        </Switch>
      </BrowserRouter>
    </AuthProvider>
  )
}
