export const LEGAL_DEFAULTS = {
  minimumProjectValue: 15000,
  partnerPublicTitle: "Strategic Business Advisor & Referral Partner",
  goAccelovateSignatoryName: "Sally Itterly",
  goAccelovateSignatoryTitle: "VP Global Client Relations",
};

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export const PARTNER_AGREEMENT_SECTIONS: LegalSection[] = [
  {
    heading: "1. Purpose",
    paragraphs: [
      "The purpose of this Agreement is to establish a non-exclusive referral relationship whereby the Partner may introduce prospective clients, business opportunities, and strategic relationships to GoAccelovate.",
    ],
  },
  {
    heading: "2. Scope of Collaboration",
    paragraphs: ["The Partner may:"],
    bullets: [
      "Introduce prospective clients and business opportunities.",
      "Facilitate introductions to founders, executives, consultants, and organizations within their network.",
      "Participate in exploratory discussions where appropriate.",
      "Provide strategic insights regarding client needs and market opportunities.",
    ],
  },
  {
    heading: "",
    paragraphs: ["The Partner is not obligated to generate any minimum number of referrals."],
  },
  {
    heading: "3. Referral Commission",
    paragraphs: [
      "For opportunities directly introduced by the Partner:",
      "{{COMMISSION_RATE}} commission on projects valued at USD {{MINIMUM_PROJECT_VALUE}} or greater.",
      "Commission shall be calculated on net revenue actually received by GoAccelovate.",
    ],
  },
  {
    heading: "4. Lead Attribution",
    paragraphs: ["A referral shall be considered attributed to the Partner when:"],
    bullets: [
      "An email introduction is made; or",
      "The opportunity is documented within GoAccelovate's partner portal; or",
      "Both parties acknowledge the introduction in writing.",
    ],
  },
  {
    heading: "5. Payment Terms",
    paragraphs: ["Referral commissions shall:"],
    bullets: [
      "Be paid proportionally based on client payments received.",
      "Be payable within thirty (30) days following receipt of client payment.",
      "Remain payable throughout the duration of the client engagement for opportunities introduced by the Partner.",
    ],
  },
  {
    heading: "6. Referral Validity",
    paragraphs: [
      "A referral shall remain eligible for commission for eighteen (18) months from the date of introduction.",
    ],
  },
  {
    heading: "7. Non-Exclusivity",
    paragraphs: [
      "This Agreement is non-exclusive. Both parties may continue to engage with other organizations and partnerships.",
    ],
  },
  {
    heading: "8. Confidentiality",
    paragraphs: [
      "Both parties agree to protect confidential information shared during the course of this relationship and not disclose such information without written consent.",
      "This obligation shall survive for two (2) years following termination.",
    ],
  },
  {
    heading: "9. Independent Relationship",
    paragraphs: [
      "Nothing in this Agreement shall create an employment, agency, partnership, or joint venture relationship.",
      "The Partner acts as an independent contractor.",
    ],
  },
  {
    heading: "10. Term and Termination",
    paragraphs: [
      "Either party may terminate this Agreement upon thirty (30) days written notice.",
      "Any earned commissions prior to termination shall remain payable.",
    ],
  },
  {
    heading: "11. Public Positioning",
    paragraphs: [
      "Subject to mutual approval, GoAccelovate may refer to the Partner as:",
      '"{{PARTNER_PUBLIC_TITLE}}" for business development purposes.',
    ],
  },
];

export const NDA_SECTIONS: LegalSection[] = [
  {
    heading: "1. Purpose",
    paragraphs: [
      "The purpose of this Agreement is to protect confidential and proprietary information shared between the parties in connection with their referral partnership and any related business discussions.",
    ],
  },
  {
    heading: "2. Definition of Confidential Information",
    paragraphs: [
      '"Confidential Information" means any information disclosed by GoAccelovate to the Receiving Party, either directly or indirectly, in writing, orally, or by inspection of tangible objects, including but not limited to:',
    ],
    bullets: [
      "Client names, contact details, and business requirements",
      "Pricing, proposals, and commercial terms",
      "Business strategies, roadmaps, and go-to-market plans",
      "Partner network details, commission structures, and operational workflows",
      "Proprietary methodologies, frameworks, and intellectual property",
      "Financial information, including revenue, costs, and projections",
      "Any information marked as confidential or that would reasonably be understood to be confidential given the nature of the disclosure",
    ],
  },
  {
    heading: "3. Obligations of the Receiving Party",
    paragraphs: ["The Receiving Party agrees to:"],
    bullets: [
      "Hold all Confidential Information in strict confidence.",
      "Not disclose Confidential Information to any third party without the prior written consent of GoAccelovate.",
      "Use Confidential Information solely for the purpose of fulfilling obligations under the Referral Partnership Agreement.",
      "Protect Confidential Information with at least the same degree of care used to protect its own confidential information, but no less than reasonable care.",
      "Promptly notify GoAccelovate upon becoming aware of any unauthorized use or disclosure of Confidential Information.",
    ],
  },
  {
    heading: "4. Exclusions",
    paragraphs: ["This Agreement does not apply to information that:"],
    bullets: [
      "Is or becomes publicly known through no breach of this Agreement.",
      "Was rightfully known by the Receiving Party before disclosure.",
      "Is independently developed by the Receiving Party without use of Confidential Information.",
      "Is required to be disclosed by law or court order, provided the Receiving Party gives GoAccelovate prompt written notice to allow GoAccelovate to seek a protective order.",
    ],
  },
  {
    heading: "5. Term",
    paragraphs: [
      "This Agreement shall remain in effect for the duration of the Referral Partnership Agreement and for two (2) years following its termination.",
    ],
  },
  {
    heading: "6. Return or Destruction of Information",
    paragraphs: [
      "Upon termination of the partnership or upon GoAccelovate's written request, the Receiving Party shall promptly return or destroy all Confidential Information in their possession, and certify in writing that they have done so.",
    ],
  },
  {
    heading: "7. No Licence",
    paragraphs: [
      "Nothing in this Agreement grants the Receiving Party any rights in or to Confidential Information except as expressly set out herein.",
    ],
  },
  {
    heading: "8. Independent Relationship",
    paragraphs: [
      "This Agreement does not create any employment, agency, partnership, or joint venture relationship between the parties.",
    ],
  },
  {
    heading: "9. Governing Law",
    paragraphs: [
      "This Agreement shall be governed by and construed in accordance with applicable law. Any disputes arising under this Agreement shall be resolved through good-faith negotiation, and if unresolved, through binding arbitration.",
    ],
  },
  {
    heading: "10. Entire Agreement",
    paragraphs: [
      "This Agreement constitutes the entire agreement between the parties with respect to confidentiality and supersedes all prior discussions or agreements on the same subject.",
    ],
  },
];

export function populateLegalText(text: string, commissionRate: number) {
  return text
    .replaceAll("{{COMMISSION_RATE}}", `${commissionRate}%`)
    .replaceAll(
      "{{MINIMUM_PROJECT_VALUE}}",
      LEGAL_DEFAULTS.minimumProjectValue.toLocaleString("en-US"),
    )
    .replaceAll("{{PARTNER_PUBLIC_TITLE}}", LEGAL_DEFAULTS.partnerPublicTitle);
}
