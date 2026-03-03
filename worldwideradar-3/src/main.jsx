import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import RegionPage from "./pages/RegionPage.jsx";
import MethodologyPage from "./pages/MethodologyPage.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/"             element={<App/>}/>
      <Route path="/region/:slug" element={<RegionPage/>}/>
      <Route path="/methodology"  element={<MethodologyPage/>}/>
      <Route path="*"             element={<App/>}/>
    </Routes>
  </BrowserRouter>
);
