import './App.css';
import AuthComponent from './component/login/Auth';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router } from "react-router-dom";
import { SuiClientProvider } from "@mysten/dapp-kit";
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider>
        <Router>
          <AuthComponent/>
        </Router>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

export default App;
