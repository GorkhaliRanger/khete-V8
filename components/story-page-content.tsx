"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Carrot,
  Clock3,
  Globe2,
  HandCoins,
  HeartHandshake,
  Leaf,
  MessagesSquare,
  PawPrint,
  Quote,
  Scale,
  ShieldCheck,
  Stethoscope,
  Tractor,
  Users,
  Wrench,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { STORY_MARQUEE_DEFAULT_EN, STORY_MARQUEE_DEFAULT_NE, siteContentSelect, type SiteContentRow } from "@/lib/site-content";
import { BrandName } from "@/components/brand-name";

type StoryLang = "en" | "ne";

export function StoryPageContent() {
  const [lang, setLang] = useState<StoryLang>("en");
  const [founderOpen, setFounderOpen] = useState(false);
  const [marqueeEn, setMarqueeEn] = useState(STORY_MARQUEE_DEFAULT_EN);
  const [marqueeNe, setMarqueeNe] = useState(STORY_MARQUEE_DEFAULT_NE);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("site_content").select(siteContentSelect).eq("key", "story_marquee").maybeSingle();
      if (!mounted || !data) return;
      const row = data as unknown as SiteContentRow;
      if (row.value_en?.trim()) setMarqueeEn(row.value_en);
      if (row.value_ne?.trim()) setMarqueeNe(row.value_ne);
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const marqueeText = (lang === "ne" ? marqueeNe : marqueeEn) || STORY_MARQUEE_DEFAULT_EN;
  const ne = lang === "ne";

  return (
    <div className="story-page">
      <div className="story-marquee" aria-hidden="true">
        <div className="story-marquee-track">
          <div className="story-marquee-half np"><span>{marqueeText}</span><span>{marqueeText}</span><span>{marqueeText}</span></div>
          <div className="story-marquee-half np"><span>{marqueeText}</span><span>{marqueeText}</span><span>{marqueeText}</span></div>
        </div>
      </div>

      <section className="story-title-block">
        <div className="site-container">
          <h1>{ne ? "हाम्रो कथा" : "Our Story"}</h1>
          <p className="story-title-intro">{ne ? <><BrandName /> ले नेपालका उपभोक्तालाई किसानसँग सिधै जोड्छ — ताजा, इमानदारीपूर्वक उत्पादित तरकारी र फलफूल, न्यायोचित मूल्यमा, बिचौलियालाई जतिसक्दो हटाएर।</> : <><BrandName /> connects consumers directly to the farmers of Nepal — fresh, honestly grown produce at fair prices, with the middleman taken out wherever we can take him out.</>}</p>
          <div className="story-lang-toggle" role="group" aria-label="Page language">
            <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>English</button>
            <button type="button" className={lang === "ne" ? "active" : ""} onClick={() => setLang("ne")}>नेपाली</button>
          </div>
        </div>
      </section>

      <section className="story-why">
        <div className="site-container">
          <p className="eyebrow">{ne ? <><BrandName /> किन</> : <>Why <BrandName /> exists</>}</p>
          <h2 className="story-why-title">{ne ? "वास्तविक कृषि आवश्यकताबाट जन्मेको बजार।" : "A marketplace shaped around real agricultural needs."}</h2>
          {ne ? (
            <div className="story-why-body np">
              <p>किसान, घरधुरी तथा कृषि व्यवसायहरूले तरकारी, उपकरण, सेवा र विश्वसनीय सूचनाका लागि प्रायः धेरै टुक्रिएका माध्यमहरूमा खोज्नुपर्ने हुन्छ। <BrandName /> ले ती आवश्यकतालाई एउटै सुव्यवस्थित बजारमा एकीकृत गर्छ।</p>
              <p>सुरुवातको चरण <BrandName /> ले प्रत्यक्ष रूपमा नै सञ्चालन गर्छ। प्लेटफर्म विस्तार हुँदै जाँदा, स्वीकृत किसान र स्वतन्त्र कृषि व्यवसायहरू प्रमाणित विक्रेता प्रणालीमार्फत सामेल हुन सक्नेछन्।</p>
            </div>
          ) : (
            <div className="story-why-body">
              <p>Farmers, households and agricultural businesses often have to search across many disconnected channels to find produce, equipment, services and dependable information. <BrandName /> brings those needs together in one organised marketplace.</p>
              <p>The first stage is managed directly by <BrandName />. As the platform grows, approved farmers and independent agricultural businesses will be able to join through a verified seller system.</p>
            </div>
          )}
        </div>
      </section>

      <section className="story-promise-section">
        <div className="site-container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{ne ? <><BrandName /> को मूल</> : <>The heart of <BrandName /></>}</p>
              <h2>{ne ? "एउटै प्लेटफर्म, दुई वाचा।" : "Two promises, one platform."}</h2>
            </div>
          </div>
          <div className="story-promise-grid">
            <article className="story-promise-card">
              <HeartHandshake />
              <h3>{ne ? "उपभोक्ताका लागि, विश्वास गर्न मिल्ने खाना" : "For the consumer, food you can trust"}</h3>
              {ne ? <p className="np"><BrandName /> अस्तित्वमा छ किनभने परिवारले तरकारी त्यसरी किन्न पाऊन् — खेतबाटै ताजा, हानिकारक रसायनविना उत्पादित, स्याहारका साथ पुर्‍याइएको। तपाईंको भान्सासम्म पुग्ने हरेक चीज साँच्चिकै ताजा र इमानदारीपूर्वक उत्पादित होस् भनेर हामी पूर्ण प्रयास गर्छौं — र यो वाचालाई प्रमाणीकरण, स्तर र ढुवानीका मापदण्डले थप बलियो बनाउँदै छौं।</p> : <p><BrandName /> exists so that families can buy produce the way it should be bought — fresh from the farm, grown without harmful chemicals, handled with care. We try our utmost to make sure what reaches your kitchen is genuinely fresh and honestly grown, and we are building the verification, handling and delivery standards to back that promise.</p>}
            </article>
            <article className="story-promise-card">
              <HandCoins />
              <h3>{ne ? "किसानका लागि, काम बराबरको मूल्य" : "For the farmer, the price the work deserves"}</h3>
              {ne ? <p className="np">इमानदारीपूर्वक उत्पादन गर्ने किसानको मिहिनेतको अधिकांश हिस्सा खाना खाने मानिससम्म पुग्नुअघि नै हराउनु हुँदैन। खेतदेखि भान्सासम्मका प्रत्येक बिचौलियाले किसानले कमाउन लागेको हिस्सा काट्छन्। <BrandName /> ले त्यो शृङ्खलालाई जति सक्दो छोट्याउँछ, ताकि उपभोक्ताले तिरेको प्रत्येक रुपैयाँको ठूलो हिस्सा जहाँ हुनुपर्छ त्यहीं — किसानको हातमा — पुगोस्।</p> : <p>A farmer who grows something honest should not lose most of its value before it ever reaches the person who eats it. Every middleman between the field and the family takes a share of what the farmer earned. <BrandName /> shortens that chain as much as possible, so more of every rupee a consumer pays lands where it belongs — with the farmer.</p>}
            </article>
          </div>
        </div>
      </section>

      <section className="home-section story-name-section">
        <div className="site-container stories-layout">
          <article className="testimonial-card">
            <Quote />
            <blockquote lang="ne">खेतिदेखि बजारसम्म।</blockquote>
            <div>
              <p>{ne ? "— खेतबाट बजारसम्म" : "— From the field to the market"}</p>
              <p className="np">{ne ? "यो सुरु हुन्छ \"खेत\" बाट — नेपाली कृषिको आधारभूमि।" : "It begins with खेत — the Nepali word for field."}</p>
            </div>
          </article>
          <div className="journal-panel">
            <p className="eyebrow">{ne ? "नाम पछाडिको अर्थ" : "The name behind the work"}</p>
            <h2>{ne ? "यो सुरु हुन्छ \"खेत\" बाट — नेपाली कृषिको आधारभूमि।" : "It begins with खेत — the Nepali word for field."}</h2>
            {ne ? (
              <p className="np"><BrandName /> को नाम नेपाली कृषिको सुरुवात बिन्दु — खेत — बाट आएको हो। E ले त्यो खेतलाई अगाडि बढाउँछ — उपकरण, विशेषज्ञता र विनिमय — माटोबाट स्क्रिनसम्म। हाम्रो यो प्रतिबद्धता एउटै वाक्यमा समेटिएको छ: खेतिदेखि बजारसम्म। यसले हामी के गर्छौं भन्ने मात्र बताउँदैन — कसका लागि गर्छौं भन्ने पनि सम्झाइरहन्छ। र नेपालका लागि बनेको बजारले नेपालका किसानहरूले बोल्ने भाषा नै बोल्नुपर्छ भन्ने मान्यतामा हामी अंग्रेजी र नेपाली दुवैमा काम गर्छौं।</p>
            ) : (
              <>
                <p><BrandName /> takes its name from खेत (khet), the field where Nepali agriculture begins. The <strong>E</strong> carries that field forward — equipment, expertise and exchange — moving it from soil to screen.</p>
                <p>That promise is captured in one line we use everywhere: <em>खेतिदेखि बजारसम्म</em> — from the farm to the market. It describes what we do, and reminds us who we do it for.</p>
                <p>And because a marketplace for Nepal should speak the languages its farmers actually use, we work bilingually in English and नेपाली.</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="story-copy story-cream">
        <div className="site-container story-grid">
          <div>
            <p className="eyebrow">{ne ? "उपकरण र पहुँच" : "Machinery & access"}</p>
            <h2>{ne ? "पावर टिलर किन्न किसानले तीन दिनको शहर यात्रा गर्नुपर्ने होइन।" : "A tiller should not cost a farmer a three-day trip to the city."}</h2>
          </div>
          <div className={ne ? "np" : ""}>
            {ne ? (
              <>
                <p>नेपालका धेरै भागमा कृषि उपकरण किन्नु बाली उमार्नुभन्दा कठिन छ। पम्प, मिनी-टिलर वा स्प्रेयर चाहिएको किसानले प्रायः सहरसम्म यात्रा गर्नुपर्छ, आपूर्तिकर्ता खोज्नुपर्छ, मेसिन असली हो कि होइन र मूल्य न्यायोचित छ कि छैन जाँच्नुपर्छ, किन्नुपर्छ — अनि त्यसलाई गाउँसम्म आफैं लैजानुपर्छ।</p>
                <p>साना किसानका लागि यही यात्रा ठूलो बाधा हो। यसले दिन, पैसा र श्रम सबै खर्चिन्छ — र यही कारण विस्तार वा आधुनिकीकरण गर्न चाहने धेरै खेतहरू कहिल्यै अगाडि बढ्न सक्दैनन्।</p>
                <p><BrandName /> ले प्रमाणित विक्रेता र क्रेतालाई एउटै ठाउँमा जोड्छ र उपकरण किसानको घरदैलोसम्म पुर्‍याउँछ — स्पष्ट स्पेसिफिकेसन, इमानदार मूल्य र यात्राको झन्झट बिना। आधुनिकीकरण एउटा निर्णय हुनुपर्छ, अभियान होइन।</p>
              </>
            ) : (
              <>
                <p>In most parts of Nepal, buying farm equipment is harder than growing the crop. A farmer who wants a pump, a mini-tiller or a sprayer often has to travel to a city, find a supplier, verify whether the machine is genuine and fairly priced, buy it — and then somehow carry it home to the village.</p>
                <p>For a small farmer, that journey is the obstacle. It costs days, money and energy, and it is exactly the reason many farms that want to scale up or modernise simply never do.</p>
                <p><BrandName /> channels verified sellers and buyers into one place and delivers equipment to the farmer&apos;s doorstep — with clear specifications, honest pricing and none of the journey. Modernisation should be a decision, not an expedition.</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="story-expert-band">
        <div className="site-container story-band-stack">
          <p className="eyebrow">{ne ? "परामर्श सञ्जाल" : "The advisory network"}</p>
          <h2 className="story-band-title">{ne ? "खेत र उत्तरको बीचमा, जोडी कतै हराइरहेको छ।" : "Somewhere between the farm and the answer, the connection is missing."}</h2>
          <div className="story-band-lead">
            {ne ? (
              <p className="np">नेपालका अधिकांश भागमा विस्तार गर्न, आधुनिकीकरण गर्न, वा खेतमा के समस्या छ भनेर बुझ्न चाहने किसानका लागि सोध्ने उचित माध्यम छैन। ज्ञान छ — देशभित्र पनि, देशबाहिर पनि — तर प्रश्न गर्ने मानिस र उत्तर दिने मानिसबीचको पुल छैन। <BrandName /> ले त्यो पुल बनाइरहेको छ — क्रमशः र सावधानीपूर्वक। प्रमाणित कृषि विशेषज्ञको सञ्जाल — नेपालका कृषिविद्, पशु चिकित्सक, कृषि इन्जिनियर तथा अनुभवी व्यवसायी, र प्लेटफर्म विस्तारसँगै अन्तर्राष्ट्रिय विशेषज्ञ पनि — ताकि टाढाको जिल्लामा सोधिएको प्रश्नको उत्तर साँच्चिकै जान्नेले दिन सकोस्।</p>
            ) : (
              <p>Across most of Nepal, a farmer who wants to scale up, modernise, or simply understand what is going wrong in a field has no proper channel to ask. The knowledge exists — inside the country and far beyond it — but there is no bridge between the person who has the question and the person who has the answer. <BrandName /> is building that bridge, gradually and carefully: a verified network of agricultural experts — agronomists, livestock specialists, agricultural engineers and vets here in Nepal, plus international specialists as the platform grows — so that a question asked in a remote district can be answered by someone who truly knows.</p>
            )}
          </div>
          <ul className="story-expert-points story-band-cards">
            <li><BadgeCheck /><div><strong>{ne ? "नाम र प्रमाणसहितका विशेषज्ञ" : "Named, verified experts"}</strong><span>{ne ? "प्रत्येक सल्लाहकारको योग्यता र विवरण सहित सूचीबद्ध छ, कसलाई भेट्दै हुनुहुन्छ भनेर स्पष्ट।" : "Every advisor is reviewed and listed with their credentials, so you know exactly who you are talking to."}</span></div></li>
            <li><MessagesSquare /><div><strong>{ne ? "विशेषज्ञलाई सोध्नुहोस्" : "Ask an Expert"}</strong><span>{ne ? "किन्नुअघि, रोप्नुअघि, उपचार गर्नुअघि व्यावहारिक मार्गदर्शन। छोटो कुराकानीले पुरै सिजन बचाउन सक्छ।" : "Practical guidance before you buy, plant, treat or invest. A short conversation can save a whole season."}</span></div></li>
            <li><Globe2 /><div><strong>{ne ? "नेपाल र विश्वबाट" : "From Nepal and beyond"}</strong><span>{ne ? "पहिले देशभित्रको विशेषज्ञता, सञ्जाल बढ्दै गएपछि अन्तर्राष्ट्रिय ज्ञान।" : "Domestic expertise first, international knowledge as the network grows."}</span></div></li>
          </ul>
          <div className="story-expert-actions">
            <Link className="primary-button" href="/experts">{ne ? "विशेषज्ञ भेट्नुहोस्" : "Meet the experts"} <ArrowRight size={18} /></Link>
            <Link className="secondary-button story-band-secondary" href="/services">{ne ? "परामर्श सेवा हेर्नुहोस्" : "Browse advisory services"}</Link>
          </div>
        </div>
      </section>

      <section className="story-alt-section">
        <div className="site-container story-grid">
          <div>
            <p className="eyebrow">{ne ? "अझ टाढाको दृष्टि" : "Looking further"}</p>
            <h2>{ne ? "नेपालको उत्पादन संसारकै भान्सासम्म पुग्नुपर्छ।" : "Nepal's produce belongs on the world's table."}</h2>
          </div>
          <div className={ne ? "np" : ""}>
            {ne ? (
              <>
                <p>नेपालको उत्पादनलाई विश्वबजारसम्म पुर्‍याउने सम्भावना साँच्चिकै उच्च छ — हाम्रो हावापानी, उचाइमा उमारिएका बाली र जैविक कृषि परम्परा विश्वभरका क्रेताले खोजिरहेकै कुरा हो। तर नेपालको एउटा खेत र विदेशको एउटा बजारबीच धेरै खाडलहरू छन्: गुणस्तर मापदण्ड, एकीकरण, प्रमाणीकरण, ढुवानी र विश्वास।</p>
                <p><BrandName /> घरबाटै सुरु गर्छ — पहिले किसान, मापदण्ड र आपूर्ति सुव्यवस्थित गर्छ — ताकि एक दिन काठमाडौंको परिवारसम्म ताजा तरकारी पुर्‍याउने यही प्लेटफर्मले नेपालको सीमाबाहिर पनि भरपर्दो र प्रमाणित रूपमा पुर्‍याउन सकोस्।</p>
              </>
            ) : (
              <>
                <p>The potential to take Nepal&apos;s produce to the world is real and high — our climates, our altitude-grown crops and our organic farming traditions are exactly what global buyers are looking for. But between a field in Nepal and a shelf abroad there are many gaps: quality standards, aggregation, certification, logistics, trust.</p>
                <p><BrandName /> starts at home — organising farmers, standards and supply first — so that one day the same platform that delivers fresh produce to a family in Kathmandu can deliver it, reliably and verifiably, to buyers far beyond Nepal&apos;s borders.</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="story-copy">
        <div className="site-container story-grid">
          <div>
            <p className="eyebrow">{ne ? "सामूहिक कृषि" : "Community farming"}</p>
            <h2>{ne ? <><BrandName /> बढ्दा, समुदाय पनि सँगै बढ्छ।</> : <>When <BrandName /> grows, the community grows with it.</>}</h2>
          </div>
          <div className={ne ? "np" : ""}>
            {ne ? (
              <>
                <p>नेपालमा कृषि सधैं सामूहिक प्रयास हो, र <BrandName /> पनि त्यसैगरी बनेको छ। हामी सामूहिक कृषिलाई प्रवर्द्धन गर्छौं — किसानहरू संगठित भई ज्ञान, उपकरण र बजार पहुँच साझा गर्ने — र कुनै सामूहिक कृषि समूहको उत्पादनको बिक्रीबाट <BrandName /> ले कमाएको नाफामध्ये एक निश्चित हिस्सा सोही समूहलाई फिर्ता दिइन्छ।</p>
                <p>अर्थात्, <BrandName /> सँगै उत्पादन गर्ने र बेच्ने समुदायले फसलबाट मात्र होइन, प्लेटफर्मको सफलताबाट पनि आम्दानी गर्छ। जमिनबाट लिने बजारले जमिनलाई केही फिर्ता दिनुपर्छ भन्ने हाम्रो मान्यता हो — हाम्रो वरपरका कृषि समुदाय जति बलियो, प्लेटफर्म — र देश — पनि उति नै बलियो।</p>
              </>
            ) : (
              <>
                <p>Agriculture in Nepal has always been a community effort, and <BrandName /> is built the same way. We actively promote community farming — farmers organising, sharing knowledge, equipment and market access together — and from the profit <BrandName /> earns on the sales of each community&apos;s produce, a certain share is given back to that community.</p>
                <p>So a community that grows and sells with <BrandName /> does not just earn from its harvest — it shares in the platform&apos;s success too. A marketplace that takes from the land should also give back to it; the stronger the farming communities around us, the stronger the platform — and the country — becomes.</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="story-founder-section">
        <div className="site-container">
          <div className="story-founder-box">
            <p className="eyebrow">{ne ? "यसको सुरुवात" : "Where it began"}</p>
            <h2>{ne ? "जुत्ता कारखानाले पाठ सिकायो। माछा ह्याचरीले बीउ रोप्यो।" : "A shoe factory taught the lessons. A fish hatchery planted the seed."}</h2>
            {ne ? (
              <p className="story-founder-summary np"><BrandName /> कुनै बैठक कोठाबाट सुरु भएन। यो त्यस्ता मानिसबाट सुरु भयो, जसले जीवनभरि चीजहरू बनाए — र बेचे: प्रमोद थापा, जसले भारतमा तीन दशक जुत्ता उद्योग बिताए, त्यसपछि नेपालमै अग्रणी कार्प ह्याचरी स्थापना गरे — र एउटै सोचले <BrandName /> को बीउ रोपे।</p>
            ) : (
              <p className="story-founder-summary"><BrandName /> did not start in a meeting room. It started with a man who has spent his life making things — and selling them: Pramod Thapa, who spent three decades in the shoe industry in India, then built one of the province&apos;s leading carp hatcheries back home in Nepal — and one recurring thought planted the seed of <BrandName />.</p>
            )}
            {founderOpen ? (
              <div className="story-founder-full">
                {ne ? (
                  <div className="np">
                    <p>प्रमोद थापाले कक्षा दश सकिने वर्ष नै ट्रेनीका रूपमा काम थाल्नुभयो, र त्यसपछि तीन दशकभन्दा बढी जुत्ता उद्योगमा बिताउँदै लगभग हरेक विभागमा काम गर्नुभयो — डिजाइन, खरिद, उत्पादन, बिक्री र विपणन। भारतमा उहाँले उत्पादन इकाइ र बिक्री इकाइ स्थापना गर्नुभयो, भारतका प्रमुख सहरहरूमा जुत्ता बेच्नुभयो, त्यहीं — विशेषतः बैंगलोर र दिल्लीमा — १० वर्षभन्दा बढी व्यवसाय गर्नुभयो, र Snapdeal, Flipkart, Myntra, Paytm र Amazon जस्ता अग्रणी अनलाइन बजारमार्फत आफ्ना उत्पादन ग्राहकसम्म पुर्‍याउनुभयो।</p>
                    <p>व्यक्तिगत कारणले उहाँ नेपाल फर्कनुपर्‍यो, र आफ्नै देशमा केही गर्न चाहनुहुन्थ्यो। कृषिप्रति आकर्षित भई उहाँले छिट्टै कार्प माछाको ह्याचरी सुरु गर्नुभयो — किनभने नेपालका माछा किसानहरू ह्याचलिङका लागि पूर्णरूपमा भारतमै निर्भर थिए। उद्देश्य सरल थियो: किसानलाई गुणस्तरीय, घरेलु ह्याचलिङ सजिलै उपलब्ध गराउनु। गुणस्तर सुनिश्चित गर्न उहाँले माछा पालन र ह्याचरी व्यवस्थापनका अनेक तालिम तथा कार्यशालामा सहभागिता जनाउनुभयो। आज, मत्स्य तथा कृषि फार्म उत्पादन र बिक्रीका दृष्टिले प्रदेशकै अग्रणी कार्प ह्याचरीहरू मध्ये एक हो — एक दशकभन्दा बढी सञ्चालनमा रहँदै क्षेत्रका ८००–१,००० माछा किसानलाई प्रत्यक्ष वा अप्रत्यक्ष रूपमा सहयोग गर्दै, र ह्याचलिङका लागि भारतमा रहेको निर्भरता अन्त्य गर्न योगदान गर्दै।</p>
                    <p>तर ह्याचरी निर्माण एक्लो संघर्ष थियो। निर्माण प्रक्रियामा रहेका कमजोरीहरू देखिए, तर सल्लाहका लागि कोही पेशेवर छैनन् थिए। निर्माणपछि पनि चुनौतीहरू एक्लै सामना गर्नुपर्‍यो। र उहाँ एउटै कुरा सोचिरहनुहुन्थ्यो: शहरमा — जहाँ सबै कुरा सजिलै पाइन्छ जस्तो लाग्छ — यस्तो गाह्रो छ भने, ग्रामीण नेपालमा कति गाह्रो होला?</p>
                    <p>त्यही सोच <BrandName /> को बीउ बन्यो।</p>
                    <figure className="story-pull-quote">
                      <Quote />
                      <blockquote>शहरमा यति गाह्रो छ भने, गाउँको त के कुरा!</blockquote>
                      <figcaption>— प्रमोद थापा, संस्थापक</figcaption>
                    </figure>
                  </div>
                ) : (
                  <div>
                    <p>Pramod Thapa began as a trainee the very year he finished class ten, and went on to spend more than three decades in the shoe industry, working through almost every department — design, procurement, manufacturing, sales and marketing. In India he built a manufacturing unit and a sales unit, sold shoes in most of the country&apos;s major cities, spent over ten years doing business there — especially in Bangalore and Delhi — and reached customers online through India&apos;s leading marketplaces: Snapdeal, Flipkart, Myntra, Paytm and Amazon.</p>
                    <p>Personal reasons eventually brought him back to Nepal, and he wanted to build something in his own country. Drawn to agriculture, he soon started a carp fish hatchery — because fish farmers in Nepal depended entirely on hatchlings imported from India. The aim was to equip farmers with high-quality, home-grown hatchlings, made easy to access. To guarantee that quality, he undertook numerous workshops and trainings in fish farming and hatchery management. Today, Matsya tatha Krishi Farm is one of the leading carp hatcheries in the province in terms of production and sales — over a decade in operation, directly and indirectly facilitating 800–1,000 fish farmers in the region, and helping end the reliance on India for hatchlings.</p>
                    <p>But building the hatchery was lonely work. He found shortcomings in the designs and in the construction process, with no professionals to consult. Even after it was completed, challenge after challenge had to be faced alone. And he kept returning to one thought: if this is how difficult it is here — in an urban area, where everything seems within reach — how much harder must it be in rural Nepal?</p>
                    <p>That thought became the seed of <BrandName />.</p>
                    <figure className="story-pull-quote">
                      <Quote />
                      <blockquote>If it is this hard in the city — what chance does the village have?</blockquote>
                      <figcaption>— Pramod Thapa, Founder</figcaption>
                    </figure>
                  </div>
                )}
              </div>
            ) : null}
            <button type="button" className="story-read-more" onClick={() => setFounderOpen((open) => !open)}>
              {founderOpen ? (ne ? "कम देखाउनुहोस्" : "Show less") : (ne ? "थप पढ्नुहोस्" : "Read more")} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      <section className="milestone-section">
        <div className="site-container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{ne ? "हाम्रा वाचाहरू" : "What we stand for"}</p>
              <h2>{ne ? "हरेक सूची पछाडिका चार वाचा।" : "Four promises behind every listing."}</h2>
            </div>
          </div>
          <div className="milestone-grid">
            <article><ShieldCheck /><strong>{ne ? "विश्वास" : "Trust"}</strong><p className={ne ? "np" : ""}>{ne ? <>प्रमाणित विक्रेता, पारदर्शी मूल्य र सावधानीपूर्वक समीक्षा गरिएका सूची। <BrandName /> मा भएको भने त्यसले आफ्नो ठाउँ कमाएको छ।</> : <>Verified sellers, transparent prices and listings reviewed with care. If it is on <BrandName />, it earned its place.</>}</p></article>
            <article><Leaf /><strong>{ne ? "ताजा र इमानदार" : "Fresh & honest"}</strong><p className={ne ? "np" : ""}>{ne ? "हानिकारक रसायनविना उत्पादित, स्याहारका साथ ढुवानी गरिएको ताजा तरकारी। हामी प्रमाणित गर्छौं — तपाईंले चिन्ता गर्नुपर्दैन।" : "Produce grown without harmful chemicals, handled carefully and delivered as fresh as the field allows. We verify so you don't have to worry."}</p></article>
            <article><Scale /><strong>{ne ? "न्याय" : "Fairness"}</strong><p className={ne ? "np" : ""}>{ne ? "उत्पादकले योग्य मूल्य पाऊन्, क्रेताले इमानदार मूल्य पाऊन्। बिचौलिया जतिसक्दो घटाइन्छ।" : "Fair prices for the people who grow, and honest prices for the people who buy. The middleman is reduced wherever we can reduce him."}</p></article>
            <article><Users /><strong>{ne ? "विशेषज्ञता र समुदाय" : "Expertise & community"}</strong><p className={ne ? "np" : ""}>{ne ? "प्लेटफर्ममै वास्तविक कृषि विशेषज्ञ, र हरेक समुदायको बिक्रीबाट कमाएको नाफाको एक हिस्सा सोही समुदायमा फिर्ता।" : "Real agricultural experts behind the platform, and a share of the profit from every community's sales given back to that community."}</p></article>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="site-container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{ne ? "बजार" : "The marketplace"}</p>
              <h2>{ne ? "कृषिलाई चाहिने सबै कुरा, एउटै ठाउँमा।" : "One place for everything a farm runs on."}</h2>
            </div>
          </div>
          <div className="pillars-grid">
            <article><Carrot /><strong>{ne ? "ताजा तरकारी" : "Fresh produce"}</strong><p className={ne ? "np" : ""}>{ne ? "हानिकारक रसायनविना उत्पादित मौसमी तरकारी, फलफूल र किसानबाटै प्रत्यक्ष सामग्री — क्रेताले विश्वास गर्न मिल्ने एकाइमा।" : "Seasonal fruit, vegetables and farm-direct staples, grown without harmful chemicals and listed in units buyers can trust."}</p></article>
            <article><Tractor /><strong>{ne ? "मेसिनरी तथा उपकरण" : "Machinery & equipment"}</strong><p className={ne ? "np" : ""}>{ne ? "टिलर, पम्प, औजार र कृषि प्रविधि — स्पष्ट स्पेसिफिकेसन, इमानदार मूल्य र घरदैलो डेलिभरीसहित।" : "Tillers, pumps, tools and farm technology, with clear specifications, honest pricing and doorstep delivery."}</p></article>
            <article><Clock3 /><strong>{ne ? "भाडा" : "Rentals"}</strong><p className={ne ? "np" : ""}>{ne ? "ट्याक्टर, टिलर र उपकरण दिन वा सिजनअनुसार — प्रयोग भएको समयकै मात्रै शुल्क।" : "Tractors, tillers and equipment by the day or by the season — pay for the hours you use."}</p></article>
            <article><Wrench /><strong>{ne ? "कृति सेवा" : "Farm services"}</strong><p className={ne ? "np" : ""}>{ne ? "माटो परीक्षण, सिँचाइ मर्मत, खोप र बाली स्याहार — अर्डर जस्तै सजिलै बुकिङ।" : "Soil testing, irrigation repair, vaccination and crop care — booked as easily as any order."}</p></article>
            <article><PawPrint /><strong>{ne ? "पशुपंक्षी" : "Livestock"}</strong><p className={ne ? "np" : ""}>{ne ? "जिम्मेवार स्रोतबाट स्वस्थ पशुपंक्षी, विवरणसहित।" : "Healthy animals and poultry from accountable sources, with the details to back them up."}</p></article>
            <article><Stethoscope /><strong>{ne ? "विशेषज्ञ सल्लाह" : "Expert advice"}</strong><p className={ne ? "np" : ""}>{ne ? "प्रमाणित कृषि विशेषज्ञको सेवा — सही समयमा पाइने सही उत्तर कुनै छुटभन्दा मूल्यवान हुन्छ।" : "Verified agricultural experts on call — the right answer at the right time is worth more than any discount."}</p></article>
          </div>
        </div>
      </section>

      <section className="story-roadmap-section" id="projects">
        <div className="site-container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{ne ? "हामी कता लाग्दैछौं" : "Where we are headed"}</p>
              <h2>{ne ? "सावधान सुरुवात, असीम सम्भावना।" : "A careful start, a much bigger field."}</h2>
            </div>
          </div>
          <div className="story-roadmap">
            <article>
              <strong>{ne ? "छनोट र नजिक" : "Curated and close"}</strong>
              <p className={ne ? "np" : ""}>{ne ? <>आज तपाईंले देख्ने बजार <BrandName /> ले प्रत्यक्ष रूपमा सञ्चालन गर्छ: मिहिनेतले बनाइएको क्याटलग, छनोट गरिएका डेलिभरी जिल्ला र सधैं जवाफ दिने सहायता। गुणस्तर पहिलो हुनुपर्छ भनेर जानीजानी सानो सुरुवात।</> : <>The marketplace you see today is managed directly by <BrandName />: a hand-built catalogue, selected delivery districts and support that answers. Small on purpose, so quality comes first.</>}</p>
              <span className="roadmap-tag">{ne ? "आज" : "Today"}</span>
            </article>
            <article>
              <strong>{ne ? "प्रमाणित सञ्जाल" : "The verified network"}</strong>
              <p className={ne ? "np" : ""}>{ne ? <>स्वीकृत किसान, सहकारी र कृषि व्यवसायहरू प्रमाणीकरण तथा भुक्तानी प्रणालीमार्फत जोडिन्छन् — स्पष्ट स्वीकृति, स्पष्ट अभिलेख, स्पष्ट जवाफदेहिता। सामूहिक कृषि समूहहरू हामीसँगै बढ्छन् — आफ्नो फसलबाट कमाउँदै, हाम्रो सफलतामा पनि अंशीयार बन्दै।</> : <>Approved farmers, cooperatives and agricultural businesses join through a verification and settlement system — clear approvals, clear records, clear accountability. Community farming groups grow with us, earning from their harvest and sharing in our success.</>}</p>
              <span className="roadmap-tag">{ne ? "अर्को चरण" : "Next"}</span>
            </article>
            <article>
              <strong>{ne ? "राष्ट्रिय बजार, निर्यातको क्षितिज" : "A national marketplace, an export horizon"}</strong>
              <p className={ne ? "np" : ""}>{ne ? <>केही जिल्लाबाट पचास र सोभन्दा बढीमा: गहिरो इनभेन्ट्री, छिटो ढुवानी, घर र विदेशका विशेषज्ञता — र नेपालको उत्पादन विश्वभर भरपर्दो र प्रमाणित रूपमा पुग्न बेहोस्ने मापदण्ड, विश्वास र लजिस्टिक।</> : <>From a few districts to fifty and beyond: deeper inventory, faster fulfilment, expertise from home and abroad — and the standards, trust and logistics that let Nepal&apos;s produce travel confidently to the world.</>}</p>
              <span className="roadmap-tag">{ne ? "लक्ष्य" : "The goal"}</span>
            </article>
          </div>
        </div>
      </section>

      <section className="story-closing">
        <div className="site-container story-closing-inner">
          <div>
            <p className="eyebrow">{ne ? "कथामा सामेल हुनुहोस्" : "Join the story"}</p>
            <h2>{ne ? "हामीसँगै बढ्नुहोस्।" : "Grow with us."}</h2>
            <p className={ne ? "np" : ""}>{ne ? <>तपाईं परिवारका लागि खाना पकाउने हुनुहुन्छ वा गाउँका लागि खेत जोनेका किसान — <BrandName /> तपाईंकै लागि बन्दैछ। खेतबाटै ताजा किन्नुहोस्, आफ्नो काम बराबरको मूल्यमा बेच्नुहोस्, र नेपाललाई लामो समयदेखि खाँचो रहेको कुरा बनाउन हामीलाई साथ दिनुहोस्।</> : <>Whether you cook for a family or farm for a village, <BrandName /> is being built for you. Buy fresh from the farm, sell at the price you deserve, and help us grow something Nepal has needed for a long time.</>}</p>
          </div>
          <div className="story-closing-actions">
            <Link className="primary-button" href="/products">{ne ? "उत्पादनहरू हेर्नुहोस्" : "Explore products"} <ArrowRight size={18} /></Link>
            <Link className="secondary-button" href="/deals">{ne ? <><BrandName /> डिल हेर्नुहोस्</> : <>See <BrandName /> deals</>}</Link>
            <Link className="secondary-button" href="/experts">{ne ? "विशेषज्ञ भेट्नुहोस्" : "Meet the experts"}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
