/**
 * Soma de meses de calendário (0013F, RN02). Pura e isomórfica (sem `"use server"`):
 * importável tanto pela server action quanto pelo diálogo cliente, garantindo que o
 * preview e a gravação usem exatamente a mesma lógica.
 *
 * Diferente de `base + N*30 dias`, soma meses reais (fev, meses de 31). Quando o dia
 * de origem não existe no mês de destino (ex.: 31 jan + 1 mês), clampa para o último
 * dia do mês de destino (28/29 fev). Preserva hora/minuto/segundo da base.
 */
export function addCalendarMonths(base: Date, months: number): Date {
  const year = base.getFullYear();
  const month = base.getMonth();
  const day = base.getDate();

  const targetMonthIndex = month + months;
  // Dia 0 do mês seguinte ao destino = último dia do mês de destino (trata overflow de ano).
  const lastDayOfTarget = new Date(year, targetMonthIndex + 1, 0).getDate();
  const clampedDay = Math.min(day, lastDayOfTarget);

  const result = new Date(base);
  // setFullYear com índice de mês > 11 rola para o ano seguinte corretamente.
  result.setFullYear(year, targetMonthIndex, clampedDay);
  return result;
}
