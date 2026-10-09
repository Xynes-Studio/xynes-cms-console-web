"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@lumia-ui/components";

export function NestedModalsFixture({
  parent,
}: {
  parent: "sheet" | "dialog";
}) {
  const [parentOpen, setParentOpen] = useState(false);
  const [nestedOpen, setNestedOpen] = useState(false);
  const Parent = parent === "sheet" ? Sheet : Dialog;
  const ParentContent = parent === "sheet" ? SheetContent : DialogContent;
  const ParentTitle = parent === "sheet" ? SheetTitle : DialogTitle;
  const ParentDescription =
    parent === "sheet" ? SheetDescription : DialogDescription;
  const ParentTrigger = parent === "sheet" ? SheetTrigger : DialogTrigger;
  const Child = parent === "sheet" ? Dialog : Sheet;
  const ChildContent = parent === "sheet" ? DialogContent : SheetContent;
  const ChildTitle = parent === "sheet" ? DialogTitle : SheetTitle;
  const ChildDescription =
    parent === "sheet" ? DialogDescription : SheetDescription;
  const ChildTrigger = parent === "sheet" ? DialogTrigger : SheetTrigger;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background p-6">
        <Parent open={parentOpen} onOpenChange={setParentOpen}>
          <ParentTrigger asChild>
            <Button>Open parent</Button>
          </ParentTrigger>
          {parentOpen && (
            <ParentContent closeLabel="Close parent" data-testid="parent-modal">
              <ParentTitle>Parent modal</ParentTitle>
              <ParentDescription>
                Harmless nested overlay fixture.
              </ParentDescription>
              <Child open={nestedOpen} onOpenChange={setNestedOpen}>
                <ChildTrigger asChild>
                  <Button>Open nested</Button>
                </ChildTrigger>
                {nestedOpen && (
                  <ChildContent
                    closeLabel="Close nested"
                    data-testid="nested-modal"
                  >
                    <ChildTitle>Nested modal</ChildTitle>
                    <ChildDescription>
                      Must dim the parent content.
                    </ChildDescription>
                  </ChildContent>
                )}
              </Child>
            </ParentContent>
          )}
        </Parent>
      </div>
    </>
  );
}
