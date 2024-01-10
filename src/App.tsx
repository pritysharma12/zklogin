import "./App.css";
import { Helmet } from "react-helmet";
import AuthComponent from "./component/login/Auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router } from "react-router-dom";
import { SuiClientProvider } from "@mysten/dapp-kit";
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider>
        <Router>
          <Helmet>
            <title>zklogin</title>
          </Helmet>
          <AuthComponent />
        </Router>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

export default App;
