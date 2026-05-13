import { Injectable, Optional, Inject } from '@angular/core';
import { NativeDateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';

@Injectable()
export class SpanishDateAdapter extends NativeDateAdapter {

  constructor(@Optional() @Inject(MAT_DATE_LOCALE) locale: string) {
    super(locale || 'es-ES');
  }

  override getFirstDayOfWeek(): number {
    return 1; // Lunes
  }

  override getDayOfWeekNames(style: 'long' | 'short' | 'narrow'): string[] {
    if (style === 'narrow')  return ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    if (style === 'short')   return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  }

  override getMonthNames(style: 'long' | 'short' | 'narrow'): string[] {
    if (style === 'long')  return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    if (style === 'short') return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return ['E','F','M','A','M','J','J','A','S','O','N','D'];
  }
}
