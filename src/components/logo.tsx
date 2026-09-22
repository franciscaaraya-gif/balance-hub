import React from "react";

export function Logo({ className, variant = "light" }: { className?: string; variant?: "light" | "dark" }) {
  if (variant === "dark") {
    return (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
        <rect x="30" y="30" width="140" height="140" rx="14" fill="none" stroke="#ffffff" strokeWidth="5"/>
        <line x1="40" y1="55" x2="160" y2="55" stroke="#ffffff" strokeWidth="3"/>
        <line x1="40" y1="88" x2="160" y2="88" stroke="#ffffff" strokeWidth="3"/>
        <line x1="40" y1="121" x2="160" y2="121" stroke="#ffffff" strokeWidth="3"/>
        <line x1="40" y1="154" x2="160" y2="154" stroke="#ffffff" strokeWidth="3"/>
        <circle cx="50" cy="55" r="8" fill="#f56a56"/>
        <circle cx="83" cy="55" r="8" fill="#f56a56"/>
        <circle cx="117" cy="55" r="8" fill="#f56a56"/>
        <circle cx="150" cy="55" r="8" fill="#f56a56"/>
        <circle cx="50" cy="88" r="8" fill="#ffffff" stroke="#1c2450" strokeWidth="1.5"/>
        <circle cx="83" cy="88" r="8" fill="#ffffff" stroke="#1c2450" strokeWidth="1.5"/>
        <circle cx="117" cy="88" r="8" fill="#f56a56"/>
        <circle cx="150" cy="88" r="8" fill="#ffffff" stroke="#1c2450" strokeWidth="1.5"/>
        <circle cx="50" cy="121" r="8" fill="#ffffff" stroke="#1c2450" strokeWidth="1.5"/>
        <circle cx="83" cy="121" r="8" fill="#f56a56"/>
        <circle cx="117" cy="121" r="8" fill="#ffffff" stroke="#1c2450" strokeWidth="1.5"/>
        <circle cx="150" cy="121" r="8" fill="#ffffff" stroke="#1c2450" strokeWidth="1.5"/>
        <circle cx="50" cy="154" r="8" fill="#f56a56"/>
        <circle cx="83" cy="154" r="8" fill="#f56a56"/>
        <circle cx="117" cy="154" r="8" fill="#f56a56"/>
        <circle cx="150" cy="154" r="8" fill="#f56a56"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="30" y="30" width="140" height="140" rx="14" fill="none" stroke="#1c2450" strokeWidth="5"/>
      <line x1="40" y1="55" x2="160" y2="55" stroke="#1c2450" strokeWidth="3"/>
      <line x1="40" y1="88" x2="160" y2="88" stroke="#1c2450" strokeWidth="3"/>
      <line x1="40" y1="121" x2="160" y2="121" stroke="#1c2450" strokeWidth="3"/>
      <line x1="40" y1="154" x2="160" y2="154" stroke="#1c2450" strokeWidth="3"/>
      <circle cx="50" cy="55" r="8" fill="#f56a56"/>
      <circle cx="83" cy="55" r="8" fill="#f56a56"/>
      <circle cx="117" cy="55" r="8" fill="#f56a56"/>
      <circle cx="150" cy="55" r="8" fill="#f56a56"/>
      <circle cx="50" cy="88" r="8" fill="#1c2450" stroke="#ffffff" strokeWidth="1.5"/>
      <circle cx="83" cy="88" r="8" fill="#1c2450" stroke="#ffffff" strokeWidth="1.5"/>
      <circle cx="117" cy="88" r="8" fill="#f56a56"/>
      <circle cx="150" cy="88" r="8" fill="#1c2450" stroke="#ffffff" strokeWidth="1.5"/>
      <circle cx="50" cy="121" r="8" fill="#1c2450" stroke="#ffffff" strokeWidth="1.5"/>
      <circle cx="83" cy="121" r="8" fill="#f56a56"/>
      <circle cx="117" cy="121" r="8" fill="#1c2450" stroke="#ffffff" strokeWidth="1.5"/>
      <circle cx="150" cy="121" r="8" fill="#1c2450" stroke="#ffffff" strokeWidth="1.5"/>
      <circle cx="50" cy="154" r="8" fill="#f56a56"/>
      <circle cx="83" cy="154" r="8" fill="#f56a56"/>
      <circle cx="117" cy="154" r="8" fill="#f56a56"/>
      <circle cx="150" cy="154" r="8" fill="#f56a56"/>
    </svg>
  );
}
