import { useEffect, useMemo, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, ScanLine, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { createProduct, updateProduct, getProductWithUnits } from "@/services/db";
import { toast } from "@/stores/toast";
import { useSettingsStore } from "@/stores/settings";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import type { ProductInput, ProductWithUnits } from "@/types";

function makeSchema(t: ReturnType<typeof useT>) {
  const sellUnitSchema = z.object({
    name: z.string().min(1, t("form.errRequired")),
    quantity_in_base_units: z.coerce
      .number({ invalid_type_error: t("form.errNumber") })
      .positive(t("form.errPositive")),
    sell_price: z.coerce
      .number({ invalid_type_error: t("form.errNumber") })
      .nonnegative(t("form.errNonNeg")),
    is_default: z.boolean(),
  });

  return z.object({
    name: z.string().min(1, t("form.errNameReq")),
    description: z.string().optional(),
    barcode: z.string().optional(),
    category: z.string().optional(),
    base_unit_name: z.string().min(1, t("form.errRequired")),
    base_unit_quantity: z.coerce.number().positive(t("form.errPositive")),
    purchase_price: z.coerce.number().nonnegative(t("form.errNonNeg")),
    stock: z.coerce.number().nonnegative(t("form.errNonNeg")),
    min_stock: z.coerce.number().nonnegative(t("form.errNonNeg")),
    sell_units: z.array(sellUnitSchema).min(1, t("form.errMinUnit")),
  });
}

type FormValues = z.input<ReturnType<typeof makeSchema>>;

interface Props {
  open: boolean;
  productId: number | null; // null = create
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY: FormValues = {
  name: "",
  description: "",
  barcode: "",
  category: "",
  base_unit_name: "unidad",
  base_unit_quantity: 1,
  purchase_price: 0,
  stock: 0,
  min_stock: 0,
  sell_units: [
    { name: "Unidad", quantity_in_base_units: 1, sell_price: 0, is_default: true },
  ],
};

export function ProductFormModal({
  open,
  productId,
  categories,
  onClose,
  onSaved,
}: Props) {
  const t = useT();
  const sym = useSettingsStore((s) => s.currencySymbol);
  const isEdit = productId != null;
  const barcodeRef = useRef<HTMLInputElement | null>(null);

  const schema = useMemo(() => makeSchema(t), [t]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "sell_units",
  });

  const sellUnits = watch("sell_units");

  useEffect(() => {
    if (!open) return;
    if (isEdit && productId != null) {
      getProductWithUnits(productId).then((p: ProductWithUnits | null) => {
        if (!p) return;
        reset({
          name: p.name,
          description: p.description ?? "",
          barcode: p.barcode ?? "",
          category: p.category ?? "",
          base_unit_name: p.base_unit_name,
          base_unit_quantity: p.base_unit_quantity,
          purchase_price: p.purchase_price,
          stock: p.stock,
          min_stock: p.min_stock,
          sell_units: p.sell_units.map((u) => ({
            name: u.name,
            quantity_in_base_units: u.quantity_in_base_units,
            sell_price: u.sell_price,
            is_default: !!u.is_default,
          })),
        });
      });
    } else {
      reset(EMPTY);
    }
  }, [open, isEdit, productId, reset]);

  function setDefault(index: number) {
    sellUnits.forEach((_, i) => {
      setValue(`sell_units.${i}.is_default`, i === index);
    });
  }

  async function onSubmit(values: FormValues) {
    const units = values.sell_units.map((u) => ({
      name: u.name,
      quantity_in_base_units: Number(u.quantity_in_base_units),
      sell_price: Number(u.sell_price),
      is_default: u.is_default,
    }));
    if (!units.some((u) => u.is_default) && units.length) {
      units[0].is_default = true;
    }

    const payload: ProductInput = {
      name: values.name,
      description: values.description || null,
      barcode: values.barcode || null,
      category: values.category || null,
      base_unit_name: values.base_unit_name,
      base_unit_quantity: Number(values.base_unit_quantity),
      purchase_price: Number(values.purchase_price),
      stock: Number(values.stock),
      min_stock: Number(values.min_stock),
      sell_units: units,
    };

    try {
      if (isEdit && productId != null) {
        await updateProduct(productId, payload);
        toast.success(t("form.updated"));
      } else {
        await createProduct(payload);
        toast.success(t("form.created"));
      }
      onSaved();
      onClose();
    } catch (e) {
      const msg = String(e);
      if (msg.includes("UNIQUE") && msg.includes("barcode")) {
        toast.error(t("form.dupBarcode"));
      } else {
        toast.error(t("form.saveError", { error: msg }));
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("form.editProduct") : t("form.newProduct")}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t("form.editDesc") : t("form.newDesc")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="name">{t("form.nameReq")}</Label>
              <Input id="name" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="description">{t("form.description")}</Label>
              <Input id="description" {...register("description")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="barcode">{t("form.barcode")}</Label>
              <div className="flex gap-2">
                <Input
                  id="barcode"
                  {...register("barcode")}
                  ref={(el) => {
                    register("barcode").ref(el);
                    barcodeRef.current = el;
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title={t("form.scanHint")}
                  onClick={() => barcodeRef.current?.focus()}
                >
                  <ScanLine className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category">{t("common.category")}</Label>
              <Input id="category" list="cat-list" {...register("category")} />
              <datalist id="cat-list">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-sm font-semibold">
              {t("form.purchaseSection")}
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="base_unit_name">{t("form.baseUnitReq")}</Label>
                <Input
                  id="base_unit_name"
                  placeholder={t("form.baseUnitPlaceholder")}
                  {...register("base_unit_name")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="base_unit_quantity">{t("form.qtyPerPack")}</Label>
                <Input
                  id="base_unit_quantity"
                  type="number"
                  step="any"
                  {...register("base_unit_quantity")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="purchase_price">
                  {t("form.purchasePrice", { sym })}
                </Label>
                <MoneyInput
                  id="purchase_price"
                  {...register("purchase_price")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min_stock">{t("form.minStock")}</Label>
                <Input
                  id="min_stock"
                  type="number"
                  step="any"
                  {...register("min_stock")}
                />
              </div>
              {!isEdit && (
                <div className="space-y-1.5">
                  <Label htmlFor="stock">{t("form.initialStock")}</Label>
                  <Input
                    id="stock"
                    type="number"
                    step="any"
                    {...register("stock")}
                  />
                </div>
              )}
            </div>
            {isEdit && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("form.stockHint")}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t("form.sellUnits")}</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    name: "",
                    quantity_in_base_units: 1,
                    sell_price: 0,
                    is_default: false,
                  })
                }
              >
                <Plus className="h-4 w-4" /> {t("common.add")}
              </Button>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_110px_110px_auto_auto] gap-2 px-1 text-xs text-muted-foreground">
                <span>{t("form.unitName")}</span>
                <span>{t("form.unitEquals")}</span>
                <span>{t("form.unitPrice", { sym })}</span>
                <span className="text-center">{t("form.default")}</span>
                <span />
              </div>
              {fields.map((field, i) => (
                <div
                  key={field.id}
                  className="grid grid-cols-[1fr_110px_110px_auto_auto] items-center gap-2"
                >
                  <Input
                    placeholder={t("form.unitNamePlaceholder")}
                    {...register(`sell_units.${i}.name`)}
                  />
                  <Input
                    type="number"
                    step="any"
                    {...register(`sell_units.${i}.quantity_in_base_units`)}
                  />
                  <MoneyInput {...register(`sell_units.${i}.sell_price`)} />
                  <button
                    type="button"
                    title={t("form.markDefault")}
                    onClick={() => setDefault(i)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-md border",
                      sellUnits?.[i]?.is_default
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        sellUnits?.[i]?.is_default && "fill-primary"
                      )}
                    />
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={fields.length === 1}
                    onClick={() => remove(i)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            {errors.sell_units && (
              <p className="mt-2 text-xs text-destructive">
                {errors.sell_units.message || t("form.errMinUnit")}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
