"use client";

import Image from "next/image";
import { BadgeCheck, MapPin, ShieldAlert } from "lucide-react";
import { formatNpr } from "@/lib/ai-chat/i18n";
import type { ChatAttachment, ChatLanguage } from "@/lib/ai-chat/types";

/**
 * Renders recommendation attachments inside chat bubbles: demo product cards
 * and demo professional profile cards.
 */
export function ChatCards({ attachment, language }: { attachment: ChatAttachment; language: ChatLanguage }) {
  if (attachment.kind === "products") {
    return (
      <div className="aichat-cards">
        {attachment.items.map((match) => {
          const over = match.budgetDifference !== null && match.budgetDifference > 0;
          const product = match.product;
          return (
            <article key={product.id} className={`aichat-product ${over ? "over-budget" : ""}`}>
              <div className="aichat-product-media">
                <Image src={product.image} alt={product.nameEn} width={96} height={96} />
              </div>
              <div className="aichat-product-body">
                <span className="aichat-tag">
                  {language === "ne" ? "डेमो" : "Demo"}
                  {over ? ` · +${match.budgetDifference!.toLocaleString("en-IN")} over budget` : ""}
                </span>
                <strong>{language === "ne" ? product.nameNe : product.nameEn}</strong>
                <span className="aichat-price">{formatNpr(product.priceNpr)}</span>
                <span className={product.inStock ? "aichat-stock" : "aichat-stock out"}>
                  {product.available
                    ? product.inStock
                      ? language === "ne"
                        ? "मौज्दात छ"
                        : "In stock"
                      : language === "ne"
                        ? "मौज्दात छैन"
                        : "Out of stock"
                    : language === "ne"
                      ? "उपलब्ध छैन"
                      : "Unavailable"}
                </span>
                <ul>
                  {product.specifications.slice(0, 3).map((spec) => (
                    <li key={spec}>{spec}</li>
                  ))}
                </ul>
                <small className="aichat-why">{match.reasons.join(" · ")}</small>
                <span className="aichat-card-cta">{language === "ne" ? "विवरण (प्रदर्शन मात्र)" : "View details (demo only)"}</span>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className="aichat-cards">
      {attachment.items.map((match) => {
        const professional = match.professional;
        return (
          <article key={professional.id} className="aichat-professional">
            <div className="aichat-professional-media">
              <Image src={professional.photo} alt={professional.name} width={72} height={72} />
            </div>
            <div className="aichat-professional-body">
              <span className="aichat-tag">{language === "ne" ? "डेमो प्रोफाइल" : "Demo profile"}</span>
              <strong>{professional.name}</strong>
              <span>{language === "ne" ? professional.specializationNe : professional.specialization}</span>
              <span className="aichat-professional-meta">
                <MapPin size={12} /> {professional.location}
                {professional.verified ? (
                  <em className="aichat-verified">
                    <BadgeCheck size={12} /> {language === "ne" ? "प्रमाणित" : "Verified"}
                  </em>
                ) : (
                  <em className="aichat-unverified">
                    <ShieldAlert size={12} /> {language === "ne" ? "प्रमाणित छैन" : "Not verified"}
                  </em>
                )}
              </span>
              <small className="aichat-why">{match.matchedSkills.join(" · ")}</small>
              <span className="aichat-card-cta">{language === "ne" ? "प्रोफाइल हेर्नुहोस् (डेमो)" : "View profile (demo)"}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
