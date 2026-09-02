// ─── FindPartnerModalDashboard.tsx ───────────────────────────────────────────
// Redesigned Get Matched flow.
// editMode={true}: skip Step 0, pre-populate from existing listing (PortfolioTable Edit).
// editMode={false}: always start at Step 0, even for returning orgs.
import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Sparkles, CheckCircle2, ArrowLeft, ExternalLink,
  ShieldCheck, Upload, FileText, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { SECTOR_OPTIONS as SECTORS } from "@/lib/sectors";
import { COUNTRIES } from "@/lib/countries";
import { ORG_TYPE_FILTERS } from "@/lib/orgTypes";

const RATE_LIMIT_ENABLED = false;

const NEEDS_OPTIONS = [
  "Funding","Technical assistance","Research capacity","Field access",
  "Networks and convening","Data and evidence","Policy influence",
  "Communications","Legal and compliance","Other",
];
const OFFERS_OPTIONS = [
  "Funding","Field access","Local implementation","Data and evidence",
  "Research capacity","Networks","Technical expertise",
  "Communications","Policy influence","Other",
];
const SDG_NAMES: Record<number,string> = {
  1:"No Poverty",2:"Zero Hunger",3:"Good Health and Well-being",
  4:"Quality Education",5:"Gender Equality",6:"Clean Water and Sanitation",
  7:"Affordable and Clean Energy",8:"Decent Work and Economic Growth",
  9:"Industry, Innovation and Infrastructure",10:"Reduced Inequalities",
  11:"Sustainable Cities and Communities",12:"Responsible Consumption and Production",
  13:"Climate Action",14:"Life Below Water",15:"Life on Land",
  16:"Peace, Justice and Strong Institutions",17:"Partnerships for the Goals",
};

type PrefillData = {
  country:string[];sectors:string[];sdgs:number[];organisation_type:string;
  needs:string[];offers:string[];description:string;partnership_sought:string;
  partnership_stage:string;partnership_duration:string;partnership_geo_specificity:string;
  partnership_budget:string;partnership_decision_timeline:string;
  partnership_success_definition:string;partnership_legal_type:string[];
  partnership_exclusivity:string;partnership_language:string[];
  partnership_team_capacity:string;partnership_funding_status:string;
  partnership_financial_transfer:string;
  partnership_working_style:string;partnership_reporting:string[];
  partnership_ip_ownership:string;partnership_constraints:string;
  partnership_prior_attempts:string;partnership_decision_maker_confirmed:boolean;
  partnership_prior_experience:boolean|null;partnership_prior_experience_detail:string;
  partnership_contact_seniority:string;partnership_physically_present:boolean|null;
  partnership_funding_status_readiness:string;partnership_theory_of_change:string;
};

type MatchResult = {
  org_id:string;fit_score:number;rationale:string;key_synergy:string;
  org:{
    id:string;organisation_name:string;description:string;organisation_type:string;
    country:string|string[];sector:string|string[];needs:string[];offers:string[];
    sdgs:number[];website?:string;email?:string;verification_status:string;
  };
};

const EMPTY_FORM:PrefillData = {
  country:[],sectors:[],sdgs:[],organisation_type:"",needs:[],offers:[],
  description:"",partnership_sought:"",partnership_stage:"",partnership_duration:"",
  partnership_geo_specificity:"",partnership_budget:"",partnership_decision_timeline:"",
  partnership_success_definition:"",partnership_legal_type:[],partnership_exclusivity:"",
  partnership_language:[],partnership_team_capacity:"",partnership_funding_status:"",
  partnership_financial_transfer:"",
  partnership_working_style:"",partnership_reporting:[],partnership_ip_ownership:"",
  partnership_constraints:"",partnership_prior_attempts:"",
  partnership_decision_maker_confirmed:false,partnership_prior_experience:null,
  partnership_prior_experience_detail:"",partnership_contact_seniority:"",
  partnership_physically_present:null,partnership_funding_status_readiness:"",
  partnership_theory_of_change:"",
};

// Step metadata — label shown in sidebar, subtitle shown in the compact header
const STEPS = [
  {label:"Describe",       subtitle:"Give AI enough detail to structure your brief."},
  {label:"The partnership",subtitle:"What kind of partnership are you creating and what does it look like in practice."},
  {label:"Where and when", subtitle:"Location, timeline, and resource signals that filter out mismatches early."},
  {label:"Focus areas",    subtitle:"Sectors, needs, offers, and the outcome you are aiming for."},
  {label:"Readiness",      subtitle:"What you have ready and how you prefer to work."},
  {label:"Confirm",        subtitle:"Theory of change, constraints, and visibility settings."},
];

// Mandatory fields per step — used to gate sidebar navigation and style Continue
function stepComplete(step:number, form:PrefillData, partnershipTitle:string, freeText:string, uploadedFile:File|null):boolean {
  switch(step){
    case 0: return partnershipTitle.trim().length>0 && (freeText.trim().length>0 || !!uploadedFile);
    case 1: return form.partnership_sought.trim().length>0 && form.partnership_stage.length>0;
    case 2: return form.country.length>0;
    case 3: return form.sectors.length>0 && form.needs.length>0 && form.offers.length>0 && form.partnership_success_definition.trim().length>0;
    case 4: return true; // all optional
    case 5: return true;
    default: return true;
  }
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function StepNav({current,onNavigate,form,partnershipTitle,freeText,uploadedFile}:{
  current:number;
  onNavigate:(n:number)=>void;
  form:PrefillData;
  partnershipTitle:string;
  freeText:string;
  uploadedFile:File|null;
}){
  return (
    <div className="w-48 shrink-0 border-r border-border flex flex-col py-5 px-3 gap-0.5 bg-background sm:w-52">
      {STEPS.map((s,i)=>{
        const done = i<current;
        const active = i===current;
        // A step is navigable if it's already been reached (done or active)
        // OR if every prior step is complete (user can skip forward only when ready)
        const priorComplete = Array.from({length:i},(_,j)=>j).every(j=>stepComplete(j,form,partnershipTitle,freeText,uploadedFile));
        const navigable = done || active || priorComplete;
        return (
          <button key={i} type="button"
            disabled={!navigable}
            onClick={()=>navigable && onNavigate(i)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors w-full ${
              active
                ? "bg-muted"
                : navigable
                ? "hover:bg-muted/60 cursor-pointer"
                : "cursor-default opacity-40"
            }`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-colors ${
              done
                ? "bg-[#2D6A4F] text-white"
                : active
                ? "bg-foreground text-background"
                : "border border-border text-muted-foreground"
            }`}>
              {done
                ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                : i+1}
            </div>
            <span className={`text-sm truncate ${active?"font-semibold text-foreground":done?"text-foreground":"text-foreground/50"}`}>
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Compact step header — no repeated label, subtitle only, small height
function StepHeader({step,subtitle}:{step:number;subtitle:string}){
  return (
    <div className="shrink-0 px-6 py-3 border-b border-border sm:px-8">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[13px] font-semibold text-foreground whitespace-nowrap">Step {step+1} of {STEPS.length}</span>
        <span className="text-foreground/40 text-[13px] hidden sm:inline">·</span>
        <p className="text-[13px] text-foreground leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
}

// Minimal footer — back + continue, reduced height
function StepFooter({onBack,onNext,onSkip,nextLabel,skipLabel,nextDisabled,loading}:{
  onBack?:()=>void;onNext?:()=>void;onSkip?:()=>void;nextLabel?:string;skipLabel?:string;nextDisabled?:boolean;loading?:boolean;
}){
  return (
    <div className="shrink-0 px-6 py-3 border-t border-border bg-background flex items-center justify-between gap-3 sm:px-8">
      {onBack
        ? <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-foreground/70 hover:text-foreground transition-colors shrink-0">
            <ArrowLeft className="w-3.5 h-3.5"/>Back
          </button>
        : <div/>}
      <div className="flex items-center gap-2">
        {onNext && (
          <button type="button" onClick={onNext} disabled={nextDisabled||loading}
            className="h-9 px-6 rounded-full text-sm font-semibold text-white bg-[#2D6A4F] hover:bg-[#245c43] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center gap-2">
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>Working...</>
              : nextLabel??"Continue"}
          </button>
        )}
        {onSkip && (
          <button type="button" onClick={onSkip}
            className="h-9 px-4 rounded-full text-sm text-foreground/60 hover:text-foreground border border-border hover:border-foreground/30 transition-colors">
            {skipLabel??"Skip"}
          </button>
        )}
      </div>
    </div>
  );
}

// Field wrapper — horizontal rule above (except first), label, optional hint
function Field({label,hint,required,first,children}:{
  label:string;hint?:string;required?:boolean;first?:boolean;children:React.ReactNode;
}){
  return (
    <div>
      {!first && <hr className="border-border mb-7"/>}
      <div className="space-y-2.5">
        <div>
          <p className="text-[13.5px] font-semibold text-foreground">
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
          </p>
          {hint && <p className="text-[13px] text-foreground/70 mt-1 leading-relaxed">{hint}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

// Radio list — single select, clean rows, no background shapes on unselected
function RadioList({options,value,onChange}:{
  options:{value:string;label:string;sub?:string}[];
  value:string;
  onChange:(v:string)=>void;
}){
  return (
    <div className="space-y-1">
      {options.map(opt=>{
        const on=value===opt.value;
        return (
          <button key={opt.value} type="button"
            onClick={()=>onChange(opt.value===value?"":opt.value)}
            className="w-full flex items-start gap-3 py-2.5 text-left transition-colors group">
            <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              on?"border-[#2D6A4F]":"border-border group-hover:border-[#2D6A4F]/50"
            }`}>
              {on && <div className="w-2 h-2 rounded-full bg-[#2D6A4F]"/>}
            </div>
            <div>
              <p className={`text-[13.5px] leading-snug ${on?"font-semibold text-[#2D6A4F]":"text-foreground"}`}>{opt.label}</p>
              {opt.sub && <p className="text-[12px] text-foreground/70 mt-0.5">{opt.sub}</p>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Dropdown — for binary or short option sets (yes/no, small enums)
function DropdownField({options,value,onChange,placeholder}:{
  options:{value:string;label:string}[];
  value:string;
  onChange:(v:string)=>void;
  placeholder?:string;
}){
  return (
    <select value={value} onChange={e=>onChange(e.target.value)}
      className="w-full h-11 px-3 rounded-lg border border-border bg-background text-[13.5px] text-foreground focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-colors">
      <option value="">{placeholder??"Select..."}</option>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// Checkbox list — no background shapes, just checkbox + label in clean rows
function CheckboxList({options,selected,onToggle}:{
  options:{value:string;label:string;sub?:string}[];
  selected:string[];
  onToggle:(v:string)=>void;
}){
  return (
    <div className="space-y-1">
      {options.map(opt=>{
        const on=selected.includes(opt.value);
        return (
          <label key={opt.value} className="flex items-start gap-3 py-2 cursor-pointer group">
            <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
              on?"bg-[#2D6A4F] border-[#2D6A4F]":"border-border group-hover:border-[#2D6A4F]/50"
            }`}>
              {on && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            <div className="flex-1">
              <p className={`text-[13.5px] leading-snug ${on?"font-semibold text-[#2D6A4F]":"text-foreground"}`}>{opt.label}</p>
              {opt.sub && <p className="text-[12px] text-foreground/70 mt-0.5">{opt.sub}</p>}
            </div>
            <input type="checkbox" checked={on} onChange={()=>onToggle(opt.value)} className="sr-only"/>
          </label>
        );
      })}
    </div>
  );
}

// Compact searchable country picker — two-column grid inside collapsible
function CountryPicker({selected,onToggle}:{selected:string[];onToggle:(v:string)=>void;}){
  const [open,setOpen]=useState(selected.length>0);
  const [search,setSearch]=useState("");
  const filtered=search.trim()
    ?COUNTRIES.filter(c=>c.toLowerCase().includes(search.toLowerCase()))
    :COUNTRIES;
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button type="button" onClick={()=>setOpen(v=>!v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted/40 transition-colors">
        <span className="font-medium">
          {selected.length>0?`${selected.length} selected`:"Select countries"}
        </span>
        {open?<ChevronUp className="w-4 h-4 text-muted-foreground"/>:<ChevronDown className="w-4 h-4 text-muted-foreground"/>}
      </button>
      {open && (
        <div className="border-t border-border">
          <div className="px-3 py-2 border-b border-border">
            <input type="text" placeholder="Search countries..." value={search}
              onChange={e=>setSearch(e.target.value)}
              className="w-full h-8 px-3 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#2D6A4F]/30"/>
          </div>
          {selected.length>0 && (
            <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5">
              {selected.map(c=>(
                <span key={c} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#2D6A4F]/10 text-[#2D6A4F] border border-[#2D6A4F]/20">
                  {c}
                  <button type="button" onClick={()=>onToggle(c)} className="hover:text-foreground transition-colors">
                    <X className="w-2.5 h-2.5"/>
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="max-h-52 overflow-y-auto px-3 pb-2 grid grid-cols-2 gap-x-4 sm:grid-cols-3">
            {filtered.map(c=>{
              const on=selected.includes(c);
              return (
                <label key={c} className="flex items-center gap-2 py-1.5 cursor-pointer group">
                  <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    on?"bg-[#2D6A4F] border-[#2D6A4F]":"border-border group-hover:border-[#2D6A4F]/50"
                  }`}>
                    {on && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <span className={`text-[13px] truncate ${on?"font-semibold text-[#2D6A4F]":"text-foreground"}`}>{c}</span>
                  <input type="checkbox" checked={on} onChange={()=>onToggle(c)} className="sr-only"/>
                </label>
              );
            })}
            {filtered.length===0 && <p className="col-span-full py-3 text-xs text-muted-foreground">No results</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// Collapsible multi-select for long lists (sectors, SDGs)
function ExpandableCheckList({label,options,selected,onToggle}:{
  label:string;options:{value:string;label:string}[];selected:string[];onToggle:(v:string)=>void;
}){
  const [open,setOpen]=useState(selected.length>0);
  const [search,setSearch]=useState("");
  const filtered=search.trim()?options.filter(o=>o.label.toLowerCase().includes(search.toLowerCase())):options;
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button type="button" onClick={()=>setOpen(v=>!v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted/40 transition-colors">
        {selected.length===0 ? (
          <span className="font-medium text-foreground/50">{label}</span>
        ) : (
          <span className="font-medium text-foreground truncate pr-2">
            {selected.length <= 3
              ? options.filter(o=>selected.includes(o.value)).map(o=>o.label).join(", ")
              : `${options.filter(o=>selected.includes(o.value)).slice(0,3).map(o=>o.label).join(", ")} +${selected.length - 3} more`
            }
          </span>
        )}
        {open?<ChevronUp className="w-4 h-4 text-foreground/40 shrink-0"/>:<ChevronDown className="w-4 h-4 text-foreground/40 shrink-0"/>}
      </button>
      {open && (
        <div className="border-t border-border">
          <div className="px-3 py-2 border-b border-border">
            <input type="text" placeholder={`Search ${label.toLowerCase()}...`} value={search}
              onChange={e=>setSearch(e.target.value)}
              className="w-full h-8 px-3 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#2D6A4F]/30"/>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-border/40">
            {filtered.map(opt=>{
              const on=selected.includes(opt.value);
              return (
                <label key={opt.value} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer group">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    on?"bg-[#2D6A4F] border-[#2D6A4F]":"border-border group-hover:border-[#2D6A4F]/50"
                  }`}>
                    {on && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <span className={`text-[13.5px] ${on?"font-semibold text-[#2D6A4F]":"text-foreground"}`}>{opt.label}</span>
                  <input type="checkbox" checked={on} onChange={()=>onToggle(opt.value)} className="sr-only"/>
                </label>
              );
            })}
            {filtered.length===0 && <p className="px-4 py-3 text-sm text-muted-foreground">No results</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// Confirm row — checkbox only, no shape background on label
function ConfirmRow({checked,onChange,label,sub}:{checked:boolean;onChange:(v:boolean)=>void;label:string;sub?:string;}){
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer group">
      <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
        checked?"bg-[#2D6A4F] border-[#2D6A4F]":"border-border group-hover:border-[#2D6A4F]/50"
      }`}>
        {checked && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
      </div>
      <div className="flex-1">
        <p className={`text-[13.5px] font-medium leading-snug ${checked?"text-[#2D6A4F]":"text-foreground"}`}>{label}</p>
        {sub && <p className="text-[12px] text-foreground/70 mt-1 leading-relaxed">{sub}</p>}
      </div>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} className="sr-only"/>
    </label>
  );
}

// Thin section label between groups of questions
function SectionLabel({label}:{label:string;}){
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pt-2">{label}</p>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function FindPartnerModalDashboard({
  isOpen,onClose,editMode=false,
}:{isOpen:boolean;onClose:()=>void;editMode?:boolean;}){
  const [,navigate]=useLocation();
  const {user}=useAuth();
  const [formStep,setFormStep]=useState(0);
  const [appState,setAppState]=useState<"form"|"matching"|"results"|"no_org"|"requires_upgrade"|"rate_limited"|"new_request_prompt">("form");
  const [freeText,setFreeText]=useState("");
  const [partnershipTitle,setPartnershipTitle]=useState("");
  const [prefilling,setPrefilling]=useState(false);
  const [prefillError,setPrefillError]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const [listPublicly,setListPublicly]=useState(true);
  const [matches,setMatches]=useState<MatchResult[]>([]);
  const [matchLimit,setMatchLimit]=useState<number|"all">(5);
  const [sentInvites,setSentInvites]=useState<Set<string>>(new Set());
  const [sendingInvite,setSendingInvite]=useState<string|null>(null);
  const [composingInvite,setComposingInvite]=useState<string|null>(null);
  const [draftMessage,setDraftMessage]=useState("");
  const [draftRequiresUpgrade,setDraftRequiresUpgrade]=useState(false);
  const [draftLoading,setDraftLoading]=useState(false);
  const [draftFailed,setDraftFailed]=useState(false);
  const [orgProfile,setOrgProfile]=useState<any>(null);
  const [form,setForm]=useState<PrefillData>(EMPTY_FORM);
  // Profile DD state — tracks the org's actual dd_* / fdd_* columns separately
  // from the form, so updates here write to profile DD, not partnership_dd_*.
  const [ddConfirmedEmpty,setDdConfirmedEmpty]=useState(false);
  type DdState = {
    // implementer (9)
    dd_financial_model:boolean; dd_audited_accounts:boolean; dd_governance_doc:boolean;
    dd_esg_assessment:boolean; dd_impact_framework:boolean; dd_environmental_policy:boolean;
    dd_safeguarding_policy:boolean; dd_legal_registration:boolean; dd_legal_compliance_declaration:boolean;
    // funder (6)
    fdd_disbursement_track_record:boolean; fdd_decision_transparency:boolean;
    fdd_conflict_disclosure:boolean; fdd_governance_doc:boolean; fdd_esg_framework:boolean;
    fdd_legal_registration:boolean;
  };
  const [ddState,setDdState]=useState<DdState>({
    dd_financial_model:false,dd_audited_accounts:false,dd_governance_doc:false,
    dd_esg_assessment:false,dd_impact_framework:false,dd_environmental_policy:false,
    dd_safeguarding_policy:false,dd_legal_registration:false,dd_legal_compliance_declaration:false,
    fdd_disbursement_track_record:false,fdd_decision_transparency:false,
    fdd_conflict_disclosure:false,fdd_governance_doc:false,fdd_esg_framework:false,
    fdd_legal_registration:false,
  });
  function toggleDd(key:keyof DdState){setDdState(p=>({...p,[key]:!p[key]}));}
  const [uploadedFile,setUploadedFile]=useState<File|null>(null);
  const [uploadMode,setUploadMode]=useState<"text"|"doc">("text");
  const fileRef=useRef<HTMLInputElement>(null);

  function setF<K extends keyof PrefillData>(key:K,val:PrefillData[K]){setForm(p=>({...p,[key]:val}));}
  function toggleArr(key:keyof PrefillData,val:string){
    setForm(p=>{const arr=p[key] as string[];return{...p,[key]:arr.includes(val)?arr.filter(v=>v!==val):[...arr,val]};});
  }
  function toggleSingle(key:keyof PrefillData,val:string){
    setForm(p=>({...p,[key]:(p[key] as string)===val?"":val}));
  }
  function goToStep(n:number){setFormStep(n);}

  useEffect(()=>{
    if(!user||!isOpen) return;
    setFormStep(0);setAppState("form");setFreeText("");setPartnershipTitle("");
    setPrefillError("");setMatches([]);setSentInvites(new Set());
    setForm(EMPTY_FORM);setUploadedFile(null);setUploadMode("text");
    setDdConfirmedEmpty(false);
    async function loadOrg(){
      const [orgRes,profileRes]=await Promise.all([
        supabase.from("organizations").select(`
          id,organisation_name,description,sector,country,organisation_type,needs,offers,sdgs,
          website,email,verification_status,partnership_listed,partnership_formed,partnership_title,
          partnership_sought,partnership_stage,partnership_duration,partnership_geo_specificity,
          partnership_budget,partnership_decision_timeline,partnership_success_definition,
          partnership_legal_type,partnership_exclusivity,partnership_language,partnership_team_capacity,
          partnership_funding_status,
          partnership_financial_transfer,partnership_working_style,partnership_reporting,
          partnership_ip_ownership,partnership_constraints,partnership_prior_attempts,
          partnership_decision_maker_confirmed,partnership_prior_experience,
          partnership_prior_experience_detail,partnership_contact_seniority,
          partnership_physically_present,partnership_theory_of_change,
          dd_financial_model,dd_audited_accounts,dd_governance_doc,dd_esg_assessment,
          dd_impact_framework,dd_environmental_policy,dd_safeguarding_policy,
          dd_legal_registration,dd_legal_compliance_declaration,
          fdd_disbursement_track_record,fdd_decision_transparency,fdd_conflict_disclosure,
          fdd_governance_doc,fdd_esg_framework,fdd_legal_registration
        `).eq("user_id",user!.id).maybeSingle(),
        supabase.from("profiles").select("org_name").eq("id",user!.id).maybeSingle(),
      ]);
      const data=orgRes.data;
      if(data&&profileRes.data?.org_name&&data.organisation_name!==profileRes.data.org_name){
        await supabase.from("organizations").update({organisation_name:profileRes.data.org_name}).eq("id",data.id);
        data.organisation_name=profileRes.data.org_name;
      }
      if(!data){setAppState("no_org");return;}
      setOrgProfile(data);
      // Seed ddState from current profile DD columns
      setDdState({
        dd_financial_model:data.dd_financial_model??false,
        dd_audited_accounts:data.dd_audited_accounts??false,
        dd_governance_doc:data.dd_governance_doc??false,
        dd_esg_assessment:data.dd_esg_assessment??false,
        dd_impact_framework:data.dd_impact_framework??false,
        dd_environmental_policy:data.dd_environmental_policy??false,
        dd_safeguarding_policy:data.dd_safeguarding_policy??false,
        dd_legal_registration:data.dd_legal_registration??false,
        dd_legal_compliance_declaration:data.dd_legal_compliance_declaration??false,
        fdd_disbursement_track_record:data.fdd_disbursement_track_record??false,
        fdd_decision_transparency:data.fdd_decision_transparency??false,
        fdd_conflict_disclosure:data.fdd_conflict_disclosure??false,
        fdd_governance_doc:data.fdd_governance_doc??false,
        fdd_esg_framework:data.fdd_esg_framework??false,
        fdd_legal_registration:data.fdd_legal_registration??false,
      });
      if(!editMode&&data.partnership_formed){setAppState("new_request_prompt");return;}
      if(RATE_LIMIT_ENABLED){
        const cutoff=new Date(Date.now()-7*60*60*1000).toISOString();
        const{data:recent}=await supabase.from("partnership_connections").select("created_at").eq("sender_user_id",user!.id).gte("created_at",cutoff).limit(1);
        if(recent&&recent.length>0){setAppState("rate_limited");return;}
      }
      if(editMode&&data.partnership_sought){
        setForm({
          country:Array.isArray(data.country)?data.country:(data.country?[data.country]:[]),
          sectors:Array.isArray(data.sector)?data.sector:(data.sector?[data.sector]:[]),
          sdgs:data.sdgs??[],organisation_type:data.organisation_type??"",
          needs:data.needs??[],offers:data.offers??[],description:data.description??"",
          partnership_sought:data.partnership_sought??"",partnership_stage:data.partnership_stage??"",
          partnership_duration:data.partnership_duration??"",
          partnership_geo_specificity:data.partnership_geo_specificity??"",
          partnership_budget:data.partnership_budget??"",
          partnership_decision_timeline:data.partnership_decision_timeline??"",
          partnership_success_definition:data.partnership_success_definition??"",
          partnership_legal_type:data.partnership_legal_type??[],
          partnership_exclusivity:data.partnership_exclusivity??"",
          partnership_language:data.partnership_language??[],
          partnership_team_capacity:data.partnership_team_capacity??"",
          partnership_funding_status:data.partnership_funding_status??"",
          partnership_financial_transfer:data.partnership_financial_transfer??"",
          partnership_working_style:data.partnership_working_style??"",
          partnership_reporting:data.partnership_reporting??[],
          partnership_ip_ownership:data.partnership_ip_ownership??"",
          partnership_constraints:data.partnership_constraints??"",
          partnership_prior_attempts:data.partnership_prior_attempts??"",
          partnership_decision_maker_confirmed:data.partnership_decision_maker_confirmed??false,
          partnership_prior_experience:data.partnership_prior_experience??null,
          partnership_prior_experience_detail:data.partnership_prior_experience_detail??"",
          partnership_contact_seniority:data.partnership_contact_seniority??"",
          partnership_physically_present:data.partnership_physically_present??null,
          partnership_funding_status_readiness:"",
          partnership_theory_of_change:data.partnership_theory_of_change??"",
        });
        setPartnershipTitle(data.partnership_title??"");
        setListPublicly(data.partnership_listed??true);
        goToStep(1);
      }
    }
    loadOrg();
  },[user,isOpen]);

  if(!isOpen) return null;

  async function runPrefill(){
    if((!freeText.trim()&&!uploadedFile)||!orgProfile) return;
    setPrefilling(true);setPrefillError("");
    try{
      const{partnership_sought,partnership_title,needs,offers,...baseProfile}=orgProfile;
      const body:any={org_profile:baseProfile};
      if(uploadedFile){
        const bytes=await uploadedFile.arrayBuffer();
        const b64=btoa(String.fromCharCode(...new Uint8Array(bytes)));
        body.document_base64=b64;body.document_type=uploadedFile.type;
        if(freeText.trim()) body.free_text=freeText;
      } else {body.free_text=freeText;}
      const{data,error}=await supabase.functions.invoke("prefill-partnership-form",{body});
      if(error||!data?.prefilled) throw new Error(error?.message??"Prefill failed");
      const p=data.prefilled;
      setForm(prev=>({...prev,
        country:p.country??[],sectors:p.sectors??[],sdgs:p.sdgs??[],
        organisation_type:p.organisation_type??"",needs:p.needs??[],offers:p.offers??[],
        description:p.description??"",partnership_sought:p.partnership_sought??"",
        partnership_stage:p.partnership_stage??"",partnership_duration:p.partnership_duration??"",
        partnership_geo_specificity:p.partnership_geo_specificity??"",
        partnership_budget:p.partnership_budget??"",
        partnership_decision_timeline:p.partnership_decision_timeline??"",
        partnership_success_definition:p.partnership_success_definition??"",
        partnership_legal_type:p.partnership_legal_type??[],
        partnership_exclusivity:p.partnership_exclusivity??"",
        partnership_language:p.partnership_language??[],
        partnership_team_capacity:p.partnership_team_capacity??"",
        partnership_funding_status:p.partnership_funding_status??"",
        partnership_theory_of_change:p.partnership_theory_of_change??"",
        partnership_prior_attempts:p.partnership_prior_attempts??"",
        partnership_constraints:p.partnership_constraints??"",
      }));
      goToStep(1);
    } catch{setPrefillError("Something went wrong. Try again or simplify your description.");}
    finally{setPrefilling(false);}
  }

  async function submitAndMatch(){
    if(!user||!orgProfile) return;
    setSubmitting(true);setAppState("matching");
    try{
      const{data:freshOrg}=await supabase.from("organizations").select("id,subscription_tier").eq("user_id",user.id).maybeSingle();
      const orgId=freshOrg?.id??orgProfile?.id;
      if(!orgId){setAppState("form");setSubmitting(false);return;}
      const tier=freshOrg?.subscription_tier??orgProfile?.subscription_tier??"";
      if(!["plus","pro","compliance"].includes(tier)){setAppState("requires_upgrade");setSubmitting(false);return;}
      const isFunder=["philanthropic_foundation","venture_capital"].includes(form.organisation_type||orgProfile?.organisation_type||"");
      await supabase.from("organizations").update({
        country:form.country,sector:form.sectors,sdgs:form.sdgs,
        organisation_type:form.organisation_type,needs:form.needs,offers:form.offers,
        description:form.description,partnership_sought:form.partnership_sought,
        partnership_title:partnershipTitle,partnership_listed:listPublicly,
        partnership_stage:form.partnership_stage||null,
        partnership_duration:form.partnership_duration||null,
        partnership_geo_specificity:form.partnership_geo_specificity||null,
        partnership_budget:form.partnership_budget||null,
        partnership_decision_timeline:form.partnership_decision_timeline||null,
        partnership_success_definition:form.partnership_success_definition||null,
        partnership_legal_type:form.partnership_legal_type.length>0?form.partnership_legal_type:null,
        partnership_exclusivity:form.partnership_exclusivity||null,
        partnership_language:form.partnership_language.length>0?form.partnership_language:null,
        partnership_team_capacity:form.partnership_team_capacity||null,
        partnership_funding_status:form.partnership_funding_status||null,
        partnership_financial_transfer:form.partnership_financial_transfer||null,
        partnership_working_style:form.partnership_working_style||null,
        partnership_reporting:form.partnership_reporting.length>0?form.partnership_reporting:null,
        partnership_ip_ownership:form.partnership_ip_ownership||null,
        partnership_constraints:form.partnership_constraints||null,
        partnership_prior_attempts:form.partnership_prior_attempts||null,
        partnership_decision_maker_confirmed:form.partnership_decision_maker_confirmed,
        partnership_prior_experience:form.partnership_prior_experience,
        partnership_prior_experience_detail:form.partnership_prior_experience_detail||null,
        partnership_contact_seniority:form.partnership_contact_seniority||null,
        partnership_physically_present:form.partnership_physically_present,
        partnership_theory_of_change:form.partnership_theory_of_change||null,
        // Profile DD columns — written from ddState, not the old partnership_dd_* form fields
        ...ddState,
        // Mirror to partnership_dd_* for backwards compatibility with OrgDetailPanel
        partnership_dd_financial_model:isFunder?false:ddState.dd_financial_model,
        partnership_dd_audited_accounts:isFunder?false:ddState.dd_audited_accounts,
        partnership_dd_safeguarding_policy:isFunder?false:ddState.dd_safeguarding_policy,
        partnership_dd_data_policy:isFunder?false:ddState.dd_legal_compliance_declaration,
        partnership_dd_governance_doc:isFunder?ddState.fdd_governance_doc:ddState.dd_governance_doc,
        ...(listPublicly?{status:"published"}:{}),
      }).eq("id",orgId).eq("user_id",user.id);
      const{data:matchData}=await supabase.functions.invoke("match-orgs-for-partnership",{
        body:{submitting_org:{...orgProfile,...form,sector:form.sectors},user_id:user.id},
      });
      setMatches(matchData?.matches??[]);
      setAppState("results");
    } catch{setAppState("results");}
    finally{setSubmitting(false);}
  }

  function fallbackInviteMessage(match:MatchResult){
    return `Hi ${match.org.organisation_name}, I'm ${orgProfile.organisation_name} and I came across your listing on Impact Natives. ${match.rationale}\n\nWould you be open to a conversation?`;
  }

  async function openComposer(match:MatchResult){
    setComposingInvite(match.org_id);setDraftMessage("");
    setDraftFailed(false);setDraftRequiresUpgrade(false);
    await generateDraft(match);
  }

  async function generateDraft(match:MatchResult){
    if(!user||!orgProfile) return;
    setDraftLoading(true);setDraftFailed(false);setDraftRequiresUpgrade(false);
    try{
      const{data:senderProfile}=await supabase.from("profiles").select("full_name").eq("id",user.id).maybeSingle();
      const{data:receiverOrgRow}=await supabase.from("organizations").select("user_id").eq("id",match.org.id).maybeSingle();
      let receiverContactName:string|null=null;
      if(receiverOrgRow?.user_id){
        const{data:rp}=await supabase.from("profiles").select("full_name").eq("id",receiverOrgRow.user_id).maybeSingle();
        receiverContactName=rp?.full_name??null;
      }
      const{data,error}=await supabase.functions.invoke("generate-partnership-invite",{body:{
        sender_org_name:orgProfile.organisation_name,
        sender_contact_name:senderProfile?.full_name??null,
        receiver_contact_name:receiverContactName,
        sender_description:orgProfile.description??null,
        sender_offers:form.offers??[],sender_needs:form.needs??[],
        partnership_title:partnershipTitle,partnership_sought:form.partnership_sought,
        partnership_stage:form.partnership_stage,partnership_duration:form.partnership_duration,
        partnership_budget:form.partnership_budget,
        partnership_decision_timeline:form.partnership_decision_timeline,
        partnership_working_style:form.partnership_working_style,
        partnership_financial_transfer:form.partnership_financial_transfer,
        partnership_team_capacity:form.partnership_team_capacity,
        receiver_org_name:match.org.organisation_name,
        receiver_description:match.org.description??null,
        receiver_needs:match.org.needs??[],receiver_offers:match.org.offers??[],
        receiver_partnership_sought:(match.org as any).partnership_sought??null,
        match_rationale:match.rationale,key_synergy:match.key_synergy,fit_score:match.fit_score,
      }});
      if(!error&&data?.message){setDraftMessage(data.message);}
      else if(data?.requires_upgrade){setDraftRequiresUpgrade(true);}
      else{setDraftFailed(true);setDraftMessage(fallbackInviteMessage(match));}
    } catch{setDraftFailed(true);setDraftMessage(fallbackInviteMessage(match));}
    finally{setDraftLoading(false);}
  }

  async function sendInvite(match:MatchResult,message:string){
    if(!user||!orgProfile) return;
    setSendingInvite(match.org_id);
    try{
      const{data:inserted,error}=await supabase.from("partnership_connections").insert({
        sender_org_id:orgProfile.id,receiver_org_id:match.org.id,
        sender_user_id:user.id,source:"ai_match",
        ai_rationale:match.rationale,fit_score:match.fit_score,status:"pending",
      }).select("id").single();
      if(error&&!error.message.includes("unique")) throw error;
      // Passed through so create_ai_match_conversation can write the new
      // conversation's id back onto this row -- without it, partnership_connections.conversation_id
      // stays null forever for AI-match invites, which breaks the messaging
      // tab's formed/declined lookups and the receiver's Accept flow.
      const connectionId=inserted?.id??null;
      const{data:receiverProfile}=await supabase.from("organizations").select("user_id").eq("id",match.org.id).single();
      const{data:convId,error:convError}=await supabase.rpc("create_ai_match_conversation",{
        p_sender_user_id:user.id,p_receiver_user_id:receiverProfile?.user_id??null,
        p_connection_id:connectionId,
      });
      if(convError) throw convError;
      if(convId){await supabase.from("messages").insert({conversation_id:convId,sender_id:user.id,body:message});}
      if(receiverProfile?.user_id&&convId){
        await supabase.rpc("send_conversation_notification",{
          p_conversation_id:convId,p_target_user_id:receiverProfile.user_id,
          p_type:"partnership_invite",p_title:"New partnership invitation",
          p_body:`${orgProfile.organisation_name} wants to explore a partnership with you.`,
          p_link:"/dashboard/portfolio?tab=partnerships",
        });
      }
      setSentInvites(prev=>new Set(prev).add(match.org_id));
      setComposingInvite(null);
    } catch(e){console.error("Send invite error:",e);}
    finally{setSendingInvite(null);}
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col"
      style={{animation:"slideUp 0.25s cubic-bezier(0.4,0,0.2,1) forwards"}}>
      <style>{`@keyframes slideUp{from{transform:translateY(100%);opacity:0;}to{transform:translateY(0);opacity:1;}}`}</style>

      {/* ── Top bar — full title, no ellipsis ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-background sm:px-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#2D6A4F] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white"/>
          </div>
          <div className="min-w-0">
            <span className="text-sm font-semibold text-foreground">Get Matched</span>
            {partnershipTitle&&appState==="form"&&formStep>0&&(
              <span className="text-xs text-muted-foreground ml-2">— {partnershipTitle}</span>
            )}
          </div>
        </div>
        <button type="button" onClick={onClose}
          className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
          Close ✕
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden flex min-h-0">

        {/* Utility states */}
        {appState==="new_request_prompt"&&(
          <div className="flex flex-col items-center justify-center flex-1 gap-8 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-[#2D6A4F]/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-[#2D6A4F]"/>
            </div>
            <div className="max-w-md">
              <h2 className="text-2xl font-bold text-foreground mb-3">Start a new partnership request?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">You've recently formed a partnership. Starting fresh replaces your current listing. Confirmed partners stay saved in Portfolio.</p>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <button type="button" onClick={onClose} className="flex-1 h-11 rounded-full border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button type="button" onClick={async()=>{
                if(!orgProfile) return;
                await supabase.from("organizations").update({partnership_formed:false,partnership_listed:false,partnership_title:null,partnership_sought:null}).eq("id",orgProfile.id);
                const{data:freshOrg}=await supabase.from("organizations").select("id,organisation_name,description,sector,country,organisation_type,needs,offers,sdgs,website,email,verification_status,partnership_listed,partnership_formed,partnership_title").eq("id",orgProfile.id).single();
                setOrgProfile(freshOrg);setPartnershipTitle("");setFreeText("");setAppState("form");goToStep(0);
              }} className="flex-1 h-11 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-semibold transition-colors">Start fresh</button>
            </div>
          </div>
        )}

        {appState==="no_org"&&(
          <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-8">
            <h2 className="text-xl font-bold text-foreground">Get Matched is for organisations</h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              Create an organisation profile first to access partnership matching. If you're an
              independent consultant, you can{" "}
              <Link href="/dashboard/upgrade-organisation?type=consultancy" onClick={onClose}
                className="text-[#2D6A4F] hover:underline font-medium">
                register a consultancy profile
              </Link>{" "}
              instead.
            </p>
            <button type="button" onClick={onClose} className="h-10 px-6 rounded-full bg-[#2D6A4F] text-white text-sm font-semibold">Close</button>
          </div>
        )}
        {appState==="requires_upgrade"&&(
          <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-8">
            <h2 className="text-xl font-bold text-foreground">Get Matched is a Plus feature</h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              AI-powered partnership matching is available on Plus and above. Upgrade your plan to see your matches.
            </p>
            <Link href="/dashboard/settings?tab=billing" onClick={onClose}
              className="h-10 px-6 rounded-full bg-[#2D6A4F] text-white text-sm font-semibold flex items-center justify-center">
              View plans
            </Link>
            <button type="button" onClick={onClose} className="h-10 px-6 rounded-full border border-border text-sm font-semibold">Close</button>
          </div>
        )}
        {appState==="rate_limited"&&(
          <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-8">
            <h2 className="text-xl font-bold text-foreground">Come back in 7 hours</h2>
            <p className="text-muted-foreground max-w-sm text-sm">You can run Get Matched once every 7 hours to keep listings current.</p>
            <button type="button" onClick={onClose} className="h-10 px-6 rounded-full bg-[#2D6A4F] text-white text-sm font-semibold">Close</button>
          </div>
        )}

        {appState==="matching"&&(
          <div className="flex flex-col items-center justify-center flex-1 gap-8 text-center px-8">
            <div className="w-20 h-20 rounded-2xl bg-[#2D6A4F]/10 flex items-center justify-center">
              <Loader2 className="w-9 h-9 text-[#2D6A4F] animate-spin"/>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">Finding your matches</h2>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">Analysing needs, offers, sectors, SDG alignment, readiness signals, and working style...</p>
            </div>
          </div>
        )}

        {appState==="results"&&(
          <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-10">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center gap-4 p-5 rounded-2xl border border-[#2D6A4F]/20 bg-[rgba(45,106,79,0.08)]">
                <div className="w-10 h-10 rounded-xl bg-[#2D6A4F] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-white"/>
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">{listPublicly?"You're listed":"Matches found"}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{listPublicly?"Your organisation now appears in the Partnerships directory.":"AI has identified potential matches based on your brief."}</p>
                </div>
              </div>
              {matches.length===0?(
                <div className="rounded-2xl border border-border p-10 text-center space-y-3">
                  <p className="text-base font-bold text-foreground">No matches found yet</p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">The Natives team has been notified and will follow up. Check back as more organisations join.</p>
                </div>
              ):(
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {Math.min(matches.length,matchLimit==="all"?matches.length:matchLimit)} of {matches.length} match{matches.length!==1?"es":""}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {([5,10,20,"all"] as const).map(opt=>(
                        <button key={opt} type="button" onClick={()=>setMatchLimit(opt)}
                          className={`h-7 px-3 rounded-full text-xs font-semibold border transition-colors ${
                            matchLimit===opt?"bg-[#2D6A4F] text-white border-[#2D6A4F]":"border-border text-muted-foreground hover:border-[#2D6A4F]/40"
                          }`}>
                          {opt==="all"?"All":`Top ${opt}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(matchLimit==="all"?matches:matches.slice(0,matchLimit)).map(match=>{
                    const invited=sentInvites.has(match.org_id);
                    const sending=sendingInvite===match.org_id;
                    const countries=Array.isArray(match.org.country)?match.org.country
                      :String(match.org.country??"").startsWith("{")
                        ?String(match.org.country).slice(1,-1).split(",").map((s:string)=>s.replace(/"/g,"").trim())
                        :[match.org.country];
                    return (
                      <div key={match.org_id} className="rounded-2xl border border-border overflow-hidden hover:border-[#2D6A4F]/30 transition-colors">
                        <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-foreground">{match.org.organisation_name}</p>
                              {match.org.verification_status==="verified"&&(
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(45,106,79,0.12)] text-[#2D6A4F]">
                                  <ShieldCheck className="w-3 h-3"/>Verified
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground capitalize">
                              {match.org.organisation_type?.replace(/_/g," ")}
                              {countries.length>0&&` · ${countries.join(", ")}`}
                            </p>
                            {match.org.description&&<p className="text-xs text-muted-foreground/80 mt-1 leading-relaxed">{match.org.description}</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-3xl font-black text-[#2D6A4F]">{match.fit_score}</div>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">fit score</div>
                          </div>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(196,92,38,0.08)]">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#C45C26]">Synergy</span>
                            <span className="text-xs text-muted-foreground">{match.key_synergy}</span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{match.rationale}</p>
                          {composingInvite===match.org_id?(
                            <div className="space-y-3 pt-3 border-t border-border">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                  {draftLoading?"Drafting...":draftRequiresUpgrade?"Upgrade for AI drafting":draftFailed?"Edit below":"AI-drafted message"}
                                </p>
                                {!draftLoading&&!draftRequiresUpgrade&&(
                                  <button type="button" onClick={()=>generateDraft(match)}
                                    className="flex items-center gap-1 text-[10px] font-semibold text-[#2D6A4F] hover:underline">
                                    <Sparkles className="w-3 h-3"/>Regenerate
                                  </button>
                                )}
                              </div>
                              {draftLoading?(
                                <div className="h-24 rounded-lg border border-border bg-muted/30 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2D6A4F]"/>Drafting...
                                </div>
                              ):(
                                <>
                                  {draftRequiresUpgrade&&(
                                    <p className="text-xs text-[#C45C26]">
                                      AI-drafted outreach needs an upgrade.{" "}
                                      <button type="button" onClick={()=>navigate("/dashboard/settings?tab=billing")} className="underline font-medium">Upgrade</button>
                                    </p>
                                  )}
                                  <textarea value={draftMessage} onChange={e=>setDraftMessage(e.target.value)}
                                    rows={5} placeholder="Write your message here..."
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"/>
                                </>
                              )}
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={()=>setComposingInvite(null)}
                                  className="h-9 px-4 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                                  Cancel
                                </button>
                                <button type="button" onClick={()=>sendInvite(match,draftMessage)}
                                  disabled={sending||draftLoading||!draftMessage.trim()}
                                  className="h-9 px-6 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-xs font-bold disabled:opacity-40 transition-colors flex items-center gap-2 ml-auto">
                                  {sending?<><Loader2 className="w-3.5 h-3.5 animate-spin"/>Sending...</>:"Send"}
                                </button>
                              </div>
                            </div>
                          ):(
                            <div className="flex items-center gap-3 pt-3 border-t border-border">
                              {invited?(
                                <span className="flex items-center gap-1.5 text-sm font-semibold text-[#2D6A4F]">
                                  <CheckCircle2 className="w-4 h-4"/>Invitation sent
                                </span>
                              ):(
                                <button type="button" onClick={()=>openComposer(match)}
                                  className="h-10 px-6 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-xs font-bold transition-colors">
                                  Reach out
                                </button>
                              )}
                              {match.org.website&&match.org.website!=="https://"&&(
                                <a href={match.org.website} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">
                                  <ExternalLink className="w-3.5 h-3.5"/>Website
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button type="button" onClick={onClose}
                className="w-full py-3.5 rounded-full border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                Done
              </button>
            </div>
          </div>
        )}

        {/* ── Form steps ── */}
        {appState==="form"&&(
          <>
            {/* Sidebar — hidden on mobile, shown sm+ */}
            <div className="hidden sm:block">
              <StepNav
                current={formStep}
                onNavigate={goToStep}
                form={form}
                partnershipTitle={partnershipTitle}
                freeText={freeText}
                uploadedFile={uploadedFile}
              />
            </div>

            {/* Step content */}
            <div className="flex flex-col flex-1 min-h-0">
              <StepHeader step={formStep} subtitle={STEPS[formStep].subtitle}/>

              {/* Scrollable form body — centered, max-width constrained */}
              <div className="flex-1 overflow-y-auto">
                <div className="w-full max-w-xl mx-auto px-4 py-7 sm:px-8">

                  {/* STEP 0 */}
                  {formStep===0&&(
                    <div className="space-y-7">
                      <Field label="Partnership title" required first>
                        <input type="text"
                          placeholder="e.g. Research partner for Nigeria health programme"
                          value={partnershipTitle} onChange={e=>setPartnershipTitle(e.target.value)}
                          className="w-full h-11 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-colors"/>
                      </Field>

                      <Field label="How would you like to describe your need?" required>
                        <div className="flex rounded-lg border border-border overflow-hidden">
                          <button type="button" onClick={()=>setUploadMode("text")}
                            className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                              uploadMode==="text"?"bg-foreground text-background":"text-foreground/70 hover:bg-muted"
                            }`}>
                            <Sparkles className="w-4 h-4"/>Write a description
                          </button>
                          <button type="button" onClick={()=>setUploadMode("doc")}
                            className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                              uploadMode==="doc"?"bg-foreground text-background":"text-foreground/70 hover:bg-muted"
                            }`}>
                            <Upload className="w-4 h-4"/>Upload a document
                          </button>
                        </div>
                      </Field>

                      {uploadMode==="text"?(
                        <Field label="Describe your partnership need"
                          hint="Include what you're working on, where, what kind of support you need, what you can offer, budget, and timeline.">
                          <textarea rows={9}
                            placeholder="e.g. We're an NGO working on last-mile health delivery in northern Nigeria. We need a UK-based research partner to help design impact evaluations and co-author publications. We can offer field access, community relationships, and local implementation capacity. Budget: £30K–£50K over 18 months starting Q3 2026..."
                            value={freeText} onChange={e=>setFreeText(e.target.value)}
                            className="w-full px-4 py-3.5 rounded-lg border border-border bg-background text-[13.5px] text-foreground placeholder:text-foreground/40 resize-none focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-colors leading-relaxed"/>
                        </Field>
                      ):(
                        <Field label="Upload your partnership strategy document"
                          hint="PDF or Word document. AI will extract sectors, needs, offers, geography, budget, and timeline.">
                          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="sr-only"
                            onChange={e=>{const f=e.target.files?.[0];if(f) setUploadedFile(f);}}/>
                          {!uploadedFile?(
                            <button type="button" onClick={()=>fileRef.current?.click()}
                              className="w-full border-2 border-dashed border-border rounded-lg py-10 flex flex-col items-center gap-3 hover:border-[#2D6A4F]/40 hover:bg-[#2D6A4F]/5 transition-colors group">
                              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-[#2D6A4F]/10 transition-colors">
                                <Upload className="w-6 h-6 text-muted-foreground group-hover:text-[#2D6A4F] transition-colors"/>
                              </div>
                              <div className="text-center">
                                <p className="text-sm font-semibold text-foreground">Click to upload</p>
                                <p className="text-xs text-muted-foreground mt-1">PDF, DOC, or DOCX — max 10MB</p>
                              </div>
                            </button>
                          ):(
                            <div className="flex items-center gap-4 p-4 rounded-lg border border-[#2D6A4F] bg-[rgba(45,106,79,0.08)]">
                              <div className="w-10 h-10 rounded-lg bg-[#2D6A4F] flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-white"/>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{uploadedFile.name}</p>
                                <p className="text-xs text-muted-foreground">{(uploadedFile.size/1024).toFixed(0)} KB</p>
                              </div>
                              <button type="button" onClick={()=>{setUploadedFile(null);if(fileRef.current) fileRef.current.value="";}}
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-4 h-4"/>
                              </button>
                            </div>
                          )}
                          {uploadedFile&&(
                            <div className="mt-4">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Add extra context <span className="font-normal">(optional)</span></p>
                              <textarea rows={3} placeholder="Any details not in the document..."
                                value={freeText} onChange={e=>setFreeText(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 transition-colors"/>
                            </div>
                          )}
                        </Field>
                      )}
                      {prefillError&&(
                        <p className="text-[13px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-4 py-3 border border-red-200 dark:border-red-800">
                          {prefillError}
                        </p>
                      )}
                    </div>
                  )}

                  {/* STEP 1 */}
                  {formStep===1&&(
                    <div className="space-y-7">
                      <Field label="What are you looking for?" required first
                        hint="Be specific — what would a good partner actually do?">
                        <Textarea
                          className="w-full text-[13.5px] resize-none rounded-lg border min-h-[110px] bg-background text-foreground"
                          value={form.partnership_sought}
                          onChange={e=>setF("partnership_sought",e.target.value)}
                          placeholder="e.g. A UK-based research institution with health systems experience who can co-design our M&E framework and co-author peer-reviewed publications."/>
                      </Field>

                      <Field label="Organisation type"
                        hint="Confirm or correct — AI may have misread this from your profile.">
                        <DropdownField
                          options={ORG_TYPE_FILTERS}
                          value={form.organisation_type}
                          onChange={v=>setF("organisation_type",v)}
                          placeholder="Select organisation type..."/>
                      </Field>

                      <Field label="Stage of work" required hint="Where is this initiative right now?">
                        <RadioList
                          options={[
                            {value:"concept",label:"Co-design from scratch",sub:"Idea defined, looking for a partner to shape it together"},
                            {value:"joining_running",label:"Join something running",sub:"Programme is active, partner plugs in"},
                            {value:"pilot",label:"Pilot phase",sub:"Testing the approach, refining before scale"},
                            {value:"scaling",label:"Scaling existing work",sub:"Proven model, expanding reach or geography"},
                          ]}
                          value={form.partnership_stage}
                          onChange={v=>toggleSingle("partnership_stage",v)}/>
                      </Field>

                      <Field label="Expected duration">
                        <DropdownField
                          options={[
                            {value:"under_6_months",label:"Under 6 months"},
                            {value:"6_12_months",label:"6–12 months"},
                            {value:"1_2_years",label:"1–2 years"},
                            {value:"2_plus_years",label:"2+ years"},
                            {value:"ongoing",label:"Ongoing"},
                          ]}
                          value={form.partnership_duration}
                          onChange={v=>setF("partnership_duration",v)}/>
                      </Field>

                      <Field label="Type of relationship" hint="Select all that apply.">
                        <CheckboxList
                          options={[
                            {value:"formal_mou",label:"Formal MoU"},
                            {value:"subcontracting",label:"Service provider arrangement"},
                            {value:"co_implementation",label:"Joint delivery"},
                            {value:"referral",label:"Referral / network"},
                            {value:"joint_venture",label:"Joint venture"},
                            {value:"informal",label:"Informal collaboration"},
                            {value:"open",label:"Open to discussion"},
                          ]}
                          selected={form.partnership_legal_type}
                          onToggle={v=>toggleArr("partnership_legal_type",v)}/>
                      </Field>

                      <Field label="Partner exclusivity">
                        <DropdownField
                          options={[
                            {value:"multiple_partners",label:"Open to multiple partners"},
                            {value:"one_dedicated_partner",label:"One dedicated partner only"},
                          ]}
                          value={form.partnership_exclusivity}
                          onChange={v=>setF("partnership_exclusivity",v)}/>
                      </Field>
                    </div>
                  )}

                  {/* STEP 2 */}
                  {formStep===2&&(
                    <div className="space-y-7">
                      <Field label="Countries you operate in" required first>
                        <CountryPicker selected={form.country} onToggle={v=>toggleArr("country",v)}/>
                      </Field>

                      <Field label="Specific location for this partnership"
                        hint="State, city, or corridor — more specific means better matches.">
                        <input type="text"
                          placeholder="e.g. Kano State, Nigeria"
                          value={form.partnership_geo_specificity}
                          onChange={e=>setF("partnership_geo_specificity",e.target.value)}
                          className="w-full h-11 px-4 rounded-lg border border-border bg-background text-[13.5px] text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-colors"/>
                      </Field>

                      <Field label="Are you physically present in the target location?">
                        <DropdownField
                          options={[
                            {value:"true",label:"Yes — on the ground"},
                            {value:"false",label:"No — working remotely"},
                          ]}
                          value={form.partnership_physically_present===null?"":String(form.partnership_physically_present)}
                          onChange={v=>setF("partnership_physically_present",v===""?null:v==="true")}/>
                      </Field>

                      <Field label="When do you need a partner by?">
                        <RadioList
                          options={[
                            {value:"immediately",label:"Immediately"},
                            {value:"within_1_month",label:"Within 1 month"},
                            {value:"1_3_months",label:"1–3 months"},
                            {value:"3_6_months",label:"3–6 months"},
                            {value:"no_fixed_timeline",label:"No fixed timeline"},
                          ]}
                          value={form.partnership_decision_timeline}
                          onChange={v=>toggleSingle("partnership_decision_timeline",v)}/>
                      </Field>

                      <Field label="Budget / resource commitment">
                        <RadioList
                          options={[
                            {value:"under_10k",label:"Under $10K"},
                            {value:"10k_50k",label:"$10K–$50K"},
                            {value:"50k_200k",label:"$50K–$200K"},
                            {value:"over_200k",label:"Over $200K"},
                            {value:"in_kind_only",label:"In-kind only"},
                            {value:"open",label:"Open to discussion"},
                          ]}
                          value={form.partnership_budget}
                          onChange={v=>toggleSingle("partnership_budget",v)}/>
                      </Field>

                      <Field label="Funding status of this work">
                        <RadioList
                          options={[
                            {value:"fully_funded",label:"Fully funded",sub:"Resources confirmed, partner executes"},
                            {value:"partially_funded",label:"Partially funded",sub:"Gap exists, partner may help close it"},
                            {value:"seeking_funding",label:"Seeking funding together",sub:"Joint fundraising with partner"},
                            {value:"partner_brings_funding",label:"Partner brings funding",sub:"We bring implementation, they fund"},
                          ]}
                          value={form.partnership_funding_status}
                          onChange={v=>toggleSingle("partnership_funding_status",v)}/>
                      </Field>

                      <Field label="Team capacity you can dedicate">
                        <DropdownField
                          options={[
                            {value:"1_part_time",label:"1 person part-time"},
                            {value:"1_full_time",label:"1 person full-time"},
                            {value:"2_5_people",label:"2–5 people"},
                            {value:"5_plus_people",label:"5+ people"},
                            {value:"tbd",label:"To be determined"},
                          ]}
                          value={form.partnership_team_capacity}
                          onChange={v=>setF("partnership_team_capacity",v)}/>
                      </Field>
                    </div>
                  )}

                  {/* STEP 3 */}
                  {formStep===3&&(
                    <div className="space-y-7">
                      <Field label="Sectors" required hint="Select all that apply to this work." first>
                        <ExpandableCheckList
                          label="Select sectors"
                          options={SECTORS.map(s=>({value:s,label:s}))}
                          selected={form.sectors}
                          onToggle={v=>toggleArr("sectors",v)}/>
                      </Field>

                      <Field label="What you need from a partner" required>
                        <CheckboxList
                          options={NEEDS_OPTIONS.map(o=>({value:o,label:o}))}
                          selected={form.needs}
                          onToggle={v=>toggleArr("needs",v)}/>
                      </Field>

                      <Field label="What you offer a partner" required>
                        <CheckboxList
                          options={OFFERS_OPTIONS.map(o=>({value:o,label:o}))}
                          selected={form.offers}
                          onToggle={v=>toggleArr("offers",v)}/>
                      </Field>

                      <Field label="What does success look like in 12 months?" required
                        hint="One sentence. This is the most important signal for match quality — it forces outcome clarity and tells the AI what to optimise for.">
                        <Textarea
                          className="w-full text-[13.5px] resize-none rounded-lg border min-h-[80px] bg-background text-foreground"
                          placeholder="e.g. A published evaluation framework co-authored with our research partner, adopted by 3 state health ministries by end of 2027."
                          value={form.partnership_success_definition}
                          onChange={e=>setF("partnership_success_definition",e.target.value)}/>
                      </Field>

                      <Field label="SDG alignment">
                        <ExpandableCheckList
                          label="Select SDGs"
                          options={Object.entries(SDG_NAMES).map(([n,name])=>({
                            value:String(n),label:`SDG ${n} — ${name}`,
                          }))}
                          selected={form.sdgs.map(String)}
                          onToggle={v=>{
                            const n=parseInt(v,10);
                            setForm(p=>({...p,sdgs:p.sdgs.includes(n)?p.sdgs.filter(s=>s!==n):[...p.sdgs,n]}));
                          }}/>
                      </Field>

                      <Field label="Working language(s)">
                        <CheckboxList
                          options={["English","French","Portuguese","Arabic","Swahili","Other"].map(l=>({value:l,label:l}))}
                          selected={form.partnership_language}
                          onToggle={v=>toggleArr("partnership_language",v)}/>
                      </Field>
                    </div>
                  )}

                  {/* STEP 4 */}
                  {formStep===4&&(
                    <div className="space-y-7">
                      {/* DD Readiness — reads and writes profile columns, not partnership_dd_* */}
                      {(()=>{
                        const isFunder=["philanthropic_foundation","venture_capital"].includes(form.organisation_type||orgProfile?.organisation_type||"");
                        const implItems:[keyof typeof ddState,string,string][]=[
                          ["dd_financial_model","Financial model","Budget projections or financial statements"],
                          ["dd_audited_accounts","Audited accounts","Third-party verified financial records"],
                          ["dd_governance_doc","Governance document","Board structure, constitution, or bylaws"],
                          ["dd_esg_assessment","ESG assessment","Environmental, social, and governance evaluation"],
                          ["dd_impact_framework","Impact measurement framework","How you track and report outcomes"],
                          ["dd_environmental_policy","Environmental policy","Your approach to environmental risk"],
                          ["dd_safeguarding_policy","Safeguarding policy","Child and vulnerable adult protection"],
                          ["dd_legal_registration","Legal registration","Certificate of incorporation or equivalent"],
                          ["dd_legal_compliance_declaration","Legal and compliance declaration","Signed declaration of compliance"],
                        ];
                        const funderItems:[keyof typeof ddState,string,string][]=[
                          ["fdd_disbursement_track_record","Disbursement track record","History of funds deployed on time"],
                          ["fdd_decision_transparency","Decision transparency","How funding decisions are made and documented"],
                          ["fdd_conflict_disclosure","Conflict of interest disclosure","Policy for managing conflicts"],
                          ["fdd_governance_doc","Governance document","Board structure and decision-making policy"],
                          ["fdd_esg_framework","ESG framework","Your stated environmental and social standards"],
                          ["fdd_legal_registration","Legal registration","Incorporation or charitable status certificate"],
                        ];
                        const items=isFunder?funderItems:implItems;
                        const total=items.length;
                        const ticked=items.filter(([key])=>ddState[key]).length;
                        const pct=Math.round((ticked/total)*100);
                        const isZero=ticked===0;
                        return (
                          <Field label="Due diligence readiness" first
                            hint={isFunder?"These reflect your organisation's funder DD profile — what you can share when implementing partners assess you.":"These reflect your organisation's DD profile — what you can share when funders and partners assess you."}>
                            {/* Score bar */}
                            <div className="mb-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[13px] text-foreground font-medium">{ticked} of {total} documents ready</span>
                                <span className="text-[13px] font-bold" style={{color:pct>=60?"#2D6A4F":pct>=30?"#C45C26":"#ef4444"}}>{pct}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-300"
                                  style={{width:`${pct}%`,background:pct>=60?"#2D6A4F":pct>=30?"#C45C26":"#ef4444"}}/>
                              </div>
                            </div>
                            {/* Zero-state prompt */}
                            {isZero&&!ddConfirmedEmpty&&(
                              <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3.5 space-y-3">
                                <p className="text-[13px] text-amber-800 dark:text-amber-300 leading-relaxed">
                                  Your DD readiness is at 0%. Partners who request documentation will find nothing on file. Tick what you genuinely have ready below, or confirm you have nothing to share right now.
                                </p>
                                <button type="button" onClick={()=>setDdConfirmedEmpty(true)}
                                  className="text-[12.5px] font-semibold text-amber-700 dark:text-amber-400 underline underline-offset-2 hover:text-amber-900 transition-colors">
                                  I have nothing to share right now
                                </button>
                              </div>
                            )}
                            {isZero&&ddConfirmedEmpty&&(
                              <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-muted border border-border">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground/50 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                                <p className="text-[13px] text-foreground/70">Confirmed — no documents right now.</p>
                                <button type="button" onClick={()=>setDdConfirmedEmpty(false)}
                                  className="ml-auto text-[12px] text-foreground/50 hover:text-foreground underline underline-offset-2 transition-colors">
                                  Undo
                                </button>
                              </div>
                            )}
                            {/* Checklist */}
                            <div className="space-y-1">
                              {items.map(([key,label,sub])=>{
                                const on=ddState[key];
                                return (
                                  <label key={key} className="flex items-start gap-3 py-2 cursor-pointer group">
                                    <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                      on?"bg-[#2D6A4F] border-[#2D6A4F]":"border-border group-hover:border-[#2D6A4F]/50"
                                    }`} onClick={()=>toggleDd(key)}>
                                      {on&&<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                                    </div>
                                    <div className="flex-1">
                                      <p className={`text-[13.5px] leading-snug ${on?"font-semibold text-[#2D6A4F]":"text-foreground"}`}>{label}</p>
                                      <p className="text-[12px] text-foreground/60 mt-0.5">{sub}</p>
                                    </div>
                                    <input type="checkbox" checked={on} onChange={()=>toggleDd(key)} className="sr-only"/>
                                  </label>
                                );
                              })}
                            </div>
                            <p className="text-[12px] text-foreground/50 mt-3">Updating this also updates your organisation profile's DD readiness score.</p>
                          </Field>
                        );
                      })()}

                      <Field label="Who leads this partnership on your side?">
                        <DropdownField
                          options={[
                            {value:"executive",label:"Executive / Director"},
                            {value:"programme_manager",label:"Programme Manager"},
                            {value:"technical_lead",label:"Technical Lead"},
                            {value:"to_be_assigned",label:"To be assigned"},
                          ]}
                          value={form.partnership_contact_seniority}
                          onChange={v=>setF("partnership_contact_seniority",v)}/>
                      </Field>

                      <Field label="Financial transfer expectation">
                        <RadioList
                          options={[
                            {value:"we_pay",label:"We provide funding or fees",sub:"We pay partners for their contribution"},
                            {value:"we_get_paid",label:"We expect compensation",sub:"We expect a subgrant or service fee"},
                            {value:"no_transfer",label:"No financial transfer",sub:"In-kind, voluntary, or co-equal"},
                            {value:"open",label:"Open to discussion",sub:"To be agreed based on partner"},
                          ]}
                          value={form.partnership_financial_transfer}
                          onChange={v=>toggleSingle("partnership_financial_transfer",v)}/>
                      </Field>

                      <Field label="Working style preference">
                        <RadioList
                          options={[
                            {value:"prefer_lead",label:"We prefer to lead",sub:"We set direction, partner delivers"},
                            {value:"equal_codesign",label:"Equal co-design",sub:"Shared decision-making throughout"},
                            {value:"prefer_support",label:"We prefer to support",sub:"Partner leads, we contribute"},
                            {value:"flexible",label:"Flexible",sub:"Depends on the partner's strengths"},
                          ]}
                          value={form.partnership_working_style}
                          onChange={v=>toggleSingle("partnership_working_style",v)}/>
                      </Field>

                      <Field label="Reporting expectations">
                        <CheckboxList
                          options={[
                            {value:"monthly",label:"Monthly updates"},
                            {value:"quarterly",label:"Quarterly check-ins"},
                            {value:"milestone_based",label:"Milestone-based only"},
                            {value:"flexible",label:"Flexible"},
                          ]}
                          selected={form.partnership_reporting}
                          onToggle={v=>toggleArr("partnership_reporting",v)}/>
                      </Field>

                      {["research_academic","technology_company","startup","social_enterprise"].includes(form.organisation_type)&&(
                        <Field label="IP and data ownership">
                          <RadioList
                            options={[
                              {value:"open_ip",label:"Open IP / shared ownership"},
                              {value:"our_org_retains",label:"Our org retains ownership"},
                              {value:"negotiable",label:"Negotiable"},
                              {value:"not_applicable",label:"Not applicable"},
                            ]}
                            value={form.partnership_ip_ownership}
                            onChange={v=>toggleSingle("partnership_ip_ownership",v)}/>
                        </Field>
                      )}

                      <Field label="Have you successfully completed a partnership before?">
                        <DropdownField
                          options={[
                            {value:"true",label:"Yes — we have completed one before"},
                            {value:"false",label:"No — this would be our first"},
                          ]}
                          value={form.partnership_prior_experience===null?"":String(form.partnership_prior_experience)}
                          onChange={v=>setF("partnership_prior_experience",v===""?null:v==="true")}/>
                        {form.partnership_prior_experience===true&&(
                          <div className="mt-4 space-y-2">
                            <p className="text-[13px] text-foreground/70">Briefly describe one completed partnership — who with, what you did, and what came of it.</p>
                            <Textarea
                              className="w-full text-[13.5px] resize-none rounded-lg border bg-background text-foreground"
                              placeholder="e.g. Co-implemented a WASH programme with WaterAid in Kaduna State 2022–23, reaching 12,000 households."
                              value={form.partnership_prior_experience_detail}
                              onChange={e=>setF("partnership_prior_experience_detail",e.target.value)}/>
                          </div>
                        )}
                      </Field>
                    </div>
                  )}

                  {/* STEP 5 */}
                  {formStep===5&&(
                    <div className="space-y-7">
                      <Field label="Your approach to creating change"
                        hint="One sentence. Helps partners check if your theories of change are compatible." first>
                        <Textarea
                          className="w-full text-[13.5px] resize-none rounded-lg border bg-background text-foreground"
                          placeholder="e.g. We believe sustainable health outcomes require community ownership from design through to delivery."
                          value={form.partnership_theory_of_change}
                          onChange={e=>setF("partnership_theory_of_change",e.target.value)}/>
                      </Field>

                      <Field label="Previous attempts at this type of partnership"
                        hint="Transparency about what you've tried builds trust and helps us match you better.">
                        <Textarea
                          className="w-full text-[13.5px] resize-none rounded-lg border bg-background text-foreground"
                          placeholder="e.g. We partnered with a UK university in 2022 but the relationship stalled due to misaligned timelines."
                          value={form.partnership_prior_attempts}
                          onChange={e=>setF("partnership_prior_attempts",e.target.value)}/>
                      </Field>

                      <Field label="Existing constraints"
                        hint="Donor restrictions, exclusivity agreements, or legal constraints partners should know before reaching out.">
                        <Textarea
                          className="w-full text-[13.5px] resize-none rounded-lg border bg-background text-foreground"
                          placeholder="e.g. Our FCDO grant restricts work to northern Nigeria only."
                          value={form.partnership_constraints}
                          onChange={e=>setF("partnership_constraints",e.target.value)}/>
                      </Field>

                      <Field label="Confirmation">
                        <div className="space-y-1">
                          <ConfirmRow
                            checked={form.partnership_decision_maker_confirmed}
                            onChange={v=>setF("partnership_decision_maker_confirmed",v)}
                            label="I am authorised to enter into partnerships on behalf of my organisation"
                            sub="Confirms to matched partners that this request has organisational backing."/>
                          <ConfirmRow
                            checked={listPublicly}
                            onChange={setListPublicly}
                            label="List publicly in the Partnerships directory"
                            sub="Other organisations can find and express interest in your listing. Uncheck to run matching privately."/>
                        </div>
                        {!listPublicly&&(
                          <p className="text-xs text-muted-foreground mt-3">Your details won't be listed publicly. The Natives team will follow up with matches directly.</p>
                        )}
                      </Field>
                    </div>
                  )}

                </div>
              </div>

              {/* Mobile step indicator */}
              <div className="sm:hidden shrink-0 px-4 py-2 border-t border-border bg-background flex items-center gap-2 overflow-x-auto">
                {STEPS.map((_,i)=>(
                  <button key={i} type="button"
                    onClick={()=>{
                      const priorComplete=Array.from({length:i},(_,j)=>j).every(j=>stepComplete(j,form,partnershipTitle,freeText,uploadedFile));
                      if(i<formStep||priorComplete) goToStep(i);
                    }}
                    className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                      i===formStep?"bg-[#2D6A4F]":i<formStep?"bg-[#2D6A4F]/40":"bg-border"
                    }`}/>
                ))}
                <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">{formStep+1}/{STEPS.length}</span>
              </div>

              <StepFooter
                onBack={formStep>0?()=>goToStep(formStep-1):undefined}
                onNext={
                  formStep===0?runPrefill
                  :formStep===5?submitAndMatch
                  :()=>goToStep(formStep+1)
                }
                onSkip={formStep===0?()=>{
                  setPrefillError("");
                  // Seed description from what the user typed so Step 1 isn't blank
                  if (freeText.trim()) setF("description", freeText.trim());
                  goToStep(1);
                }:undefined}
                skipLabel="Proceed without AI"
                nextLabel={
                  formStep===0?"Structure with AI"
                  :formStep===5?(listPublicly?"List and find matches":"Find matches privately")
                  :undefined
                }
                nextDisabled={formStep===0?((!freeText.trim()&&!uploadedFile)||!partnershipTitle.trim()):!stepComplete(formStep,form,partnershipTitle,freeText,uploadedFile)}
                loading={formStep===0?prefilling:formStep===5?submitting:false}/>
            </div>
          </>
        )}
      </div>
    </div>
  );
}