"use client";

import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
import type { Listing } from "@/data/marketplace";

type ProductQuestion = { question: string; answer: string };

function buildQuestions(listing: Listing): ProductQuestion[] {
  const districts = listing.district.length
    ? `${listing.district.slice(0, 3).join(", ")}${listing.district.length > 3 ? ` and ${listing.district.length - 3} more districts` : ""}`
    : "your district";
  const questions: ProductQuestion[] = [];

  if (listing.type === "product") {
    questions.push(
      {
        question: `Is this ${listing.grandchildCategory.toLowerCase()} suitable for the current planting season in Nepal?`,
        answer: `Yes. This listing is curated by Khet E field officers for the active growing calendar. Sowing and usage windows are printed on the pack, and our agronomy team can confirm timing for your zone on request.`,
      },
      {
        question: "What is the correct dosage or application rate per ropani?",
        answer: `Recommended rates are listed on the product label. As a rule of thumb our team suggests starting with the label rate per ropani and adjusting to soil test results — Khet E experts can help you calculate the exact quantity before you order.`,
      },
      {
        question: "How should I store it after opening?",
        answer: "Keep it sealed in a cool, dry place away from direct sunlight and moisture. Properly stored, it stays effective through the full season.",
      },
    );
  } else if (listing.type === "produce") {
    questions.push(
      {
        question: "How fresh is the produce when it is dispatched?",
        answer: "Produce is harvested to order and dispatched within 24 hours of picking, so it reaches you in field-fresh condition.",
      },
      {
        question: "Can I order in bulk for a restaurant, hotel, or resale?",
        answer: `Yes. Bulk and recurring supply are supported — message the Khet E team with your weekly volume and we will confirm pricing per ${listing.unit ?? "unit"} before checkout.`,
      },
    );
  } else if (listing.type === "livestock") {
    questions.push(
      {
        question: "Are the animals vaccinated and health-checked?",
        answer: "Yes. Every livestock listing is health-checked and vaccinated by a registered veterinarian before handover, and the records travel with the animal.",
      },
      {
        question: "How is the animal transported to my farm?",
        answer: `Khet E arranges safe transport to ${districts}. Transport timing and any crate or bedding needs are confirmed with you after reservation.`,
      },
    );
  } else if (listing.type === "service" || listing.type === "rental") {
    questions.push(
      {
        question: "Does an operator come with the machine, or do I run it myself?",
        answer: "Both options are available. You can book machine-only or machine-plus-operator — the final quote is confirmed with you before the date is locked in.",
      },
      {
        question: "How far in advance should I book?",
        answer: "We recommend booking at least 3–5 days ahead in peak season. Off-season, next-day slots are usually available.",
      },
    );
  }

  questions.push(
    {
      question: `Do you deliver to my district, and is Cash on Delivery available?`,
      answer: `This listing currently delivers to ${districts}. Cash on Delivery is available on eligible orders — the exact delivery fee and timing are calculated from your address at checkout.`,
    },
    {
      question: "What if the product arrives damaged or is not as described?",
      answer: "Khet E offers 7-day easy returns on unused items that arrive damaged or not as described. Raise a request from your orders page and our support team resolves it with a replacement or refund.",
    },
  );

  return questions.slice(0, 5);
}

export function ProductQna({ listing }: { listing: Listing }) {
  const questions = buildQuestions(listing);

  return (
    <section className="pdp-qna" aria-labelledby="pdp-qna-heading">
      <div className="pdp-qna-head">
        <div>
          <h2 id="pdp-qna-heading">Questions about this product</h2>
          <p>Answered by the Khet E support and field team</p>
        </div>
        <Link className="pdp-qna-ask" href="/support">
          <MessageCircleQuestion size={17} /> Ask a question
        </Link>
      </div>
      <div className="pdp-qna-list">
        {questions.map((item) => (
          <article className="pdp-qna-item" key={item.question}>
            <p className="pdp-qna-q"><span>Q:</span> {item.question}</p>
            <p className="pdp-qna-a"><span>A:</span> {item.answer}</p>
            <small>Khet E Support · answered within a day</small>
          </article>
        ))}
      </div>
    </section>
  );
}
