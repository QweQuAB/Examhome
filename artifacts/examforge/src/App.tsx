import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Layout } from "@/components/Layout";
import Home from "@/pages/Home";
import ExamNew from "@/pages/ExamNew";
import ExamDetail from "@/pages/ExamDetail";
import ExamTake from "@/pages/ExamTake";
import AttemptTake from "@/pages/AttemptTake";
import Community from "@/pages/Community";
import CommunityPackageDetail from "@/pages/CommunityPackageDetail";
import CommunityUpload from "@/pages/CommunityUpload";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/exams/new" component={ExamNew} />
        <Route path="/exams/:examId/take" component={ExamTake} />
        <Route path="/exams/:examId" component={ExamDetail} />
        <Route path="/attempts/:attemptId" component={AttemptTake} />
        <Route path="/community" component={Community} />
        <Route path="/community/upload" component={CommunityUpload} />
        <Route path="/community/:packageId" component={CommunityPackageDetail} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;