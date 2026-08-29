"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FieldFooter } from "@/components/forms/field-footer";
import { replayShake } from "@/components/forms/shake";
import { createLead } from "@/lib/actions/leads";
import { MAX_LENGTHS, isValidEmail, isValidPhone } from "@/lib/validation";

type FieldName = "name" | "email" | "phone" | "company" | "note";

const emptyValues: Record<FieldName, string> = {
  name: "",
  email: "",
  phone: "",
  company: "",
  note: "",
};

export function LeadForm() {
  const [values, setValues] = useState(emptyValues);
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    name: false,
    email: false,
    phone: false,
    company: false,
    note: false,
  });

  const nameRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const companyRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const shakeRefs: Record<FieldName, React.RefObject<HTMLDivElement | null>> = {
    name: nameRef,
    email: emailRef,
    phone: phoneRef,
    company: companyRef,
    note: noteRef,
  };

  const errors: Record<FieldName, string | undefined> = {
    name:
      values.name.trim().length === 0
        ? "Name is required."
        : values.name.length > MAX_LENGTHS.name
          ? `Keep it under ${MAX_LENGTHS.name} characters.`
          : undefined,
    email:
      values.email.trim().length === 0
        ? "Email is required."
        : values.email.length > MAX_LENGTHS.email
          ? `Keep it under ${MAX_LENGTHS.email} characters.`
          : !isValidEmail(values.email)
            ? "That doesn't look like a valid email."
            : undefined,
    phone:
      values.phone.trim().length === 0
        ? "Phone is required."
        : values.phone.length > MAX_LENGTHS.phone
          ? `Keep it under ${MAX_LENGTHS.phone} characters.`
          : !isValidPhone(values.phone)
            ? "That doesn't look like a valid phone number."
            : undefined,
    company:
      values.company.length > MAX_LENGTHS.company
        ? `Keep it under ${MAX_LENGTHS.company} characters.`
        : undefined,
    note:
      values.note.length > MAX_LENGTHS.note
        ? `Keep it under ${MAX_LENGTHS.note} characters.`
        : undefined,
  };

  const isValid = Object.values(errors).every((error) => !error);

  const touchAllAndShake = () => {
    setTouched({ name: true, email: true, phone: true, company: true, note: true });
    (Object.keys(errors) as FieldName[]).forEach((name) => {
      if (errors[name]) replayShake(shakeRefs[name].current);
    });
  };

  // Note: onBlur is intentionally NOT part of this shared factory — the
  // react-compiler ref-safety lint can't prove a ref read inside a closure
  // built by a function invoked during render is deferred, even though it
  // only actually runs on blur. Each field wires its own onBlur below,
  // reading its own directly-named ref instead of a dynamic lookup.
  const bind = (name: FieldName) => ({
    id: name,
    name,
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [name]: event.target.value })),
    "aria-invalid": (touched[name] && Boolean(errors[name])) || undefined,
  });

  const touch = (name: FieldName) => setTouched((t) => ({ ...t, [name]: true }));

  return (
    <form
      action={createLead}
      onSubmit={(event) => {
        if (!isValid) {
          event.preventDefault();
          touchAllAndShake();
        }
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">
          Name <span className="text-destructive">*</span>
        </Label>
        <div ref={nameRef} className="t-input">
          <Input
            {...bind("name")}
            onBlur={() => {
              touch("name");
              if (errors.name) replayShake(nameRef.current);
            }}
            placeholder="Jane Doe"
            maxLength={MAX_LENGTHS.name + 20}
          />
        </div>
        <FieldFooter
          error={touched.name ? errors.name : undefined}
          count={values.name.length}
          max={MAX_LENGTHS.name}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">
          Email <span className="text-destructive">*</span>
        </Label>
        <div ref={emailRef} className="t-input">
          <Input
            {...bind("email")}
            onBlur={() => {
              touch("email");
              if (errors.email) replayShake(emailRef.current);
            }}
            type="email"
            placeholder="jane@example.com"
          />
        </div>
        <FieldFooter error={touched.email ? errors.email : undefined} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">
          Phone <span className="text-destructive">*</span>
        </Label>
        <div ref={phoneRef} className="t-input">
          <Input
            {...bind("phone")}
            onBlur={() => {
              touch("phone");
              if (errors.phone) replayShake(phoneRef.current);
            }}
            type="tel"
            placeholder="+1 555 000 0000"
          />
        </div>
        <FieldFooter error={touched.phone ? errors.phone : undefined} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="company">Company</Label>
        <div ref={companyRef} className="t-input">
          <Input
            {...bind("company")}
            onBlur={() => {
              touch("company");
              if (errors.company) replayShake(companyRef.current);
            }}
            placeholder="Acme Co."
            maxLength={MAX_LENGTHS.company + 20}
          />
        </div>
        <FieldFooter
          error={touched.company ? errors.company : undefined}
          count={values.company.length}
          max={MAX_LENGTHS.company}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Note</Label>
        <div ref={noteRef} className="t-input">
          <Textarea
            {...bind("note")}
            onBlur={() => {
              touch("note");
              if (errors.note) replayShake(noteRef.current);
            }}
            placeholder="How this lead came in, what they need…"
            rows={3}
            maxLength={MAX_LENGTHS.note + 50}
          />
        </div>
        <FieldFooter
          error={touched.note ? errors.note : undefined}
          count={values.note.length}
          max={MAX_LENGTHS.note}
        />
      </div>

      <Button type="submit" className="mt-2" disabled={!isValid}>
        Add lead
      </Button>
    </form>
  );
}
