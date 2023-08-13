import { Component } from '@angular/core';
import { BigNumber } from 'bignumber.js';
import { debounce } from 'lodash';
import {PlotPlan, PlotPlanCalculator} from './plot-plan-calculator'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public possibleCapacityDenominators: string[] = ['GB', 'TB'];
  public capacity = 0;
  public plotPlan = PlotPlanCalculator.emptyPlotPlan
  public isCalculating = false;

  private _selectedCapacityDenominator = 'GB';
  private worker: Worker | null = null;
  private readonly plotPlanCalculator: PlotPlanCalculator = new PlotPlanCalculator()
  private readonly debouncedPlotPlanUpdate: () => void;

  constructor() {
    this.initializeWebWorker();
    this.debouncedPlotPlanUpdate = debounce(() => {
      if (this.worker !== null) {
        this.isCalculating = true;
        this.worker.postMessage(this.capacityInGb);
      } else {
        this.plotPlan = this.calculatePlotPlan();
      }
    }, 200, { leading: true });
  }

  public get errorString() {
    if (this.capacity < 0) {
      return 'Your capacity can\'t be negative';
    }
    if (this.worker == null && this.capacityInGb > 1000000) {
      return 'Your capacity is too large, currently at most 100TB are supported';
    }

    return null;
  }

  public updatePlotPlan() {
    if (this.errorString) {
      return;
    }
    if (!this.capacity) {
      this.plotPlan = PlotPlanCalculator.emptyPlotPlan

      return
    }
    this.debouncedPlotPlanUpdate();
  }

  public getPercentageOfCapacity(spaceInGb: number) {
    if (this.errorString) {
      return 0;
    }
    if (!this.capacity) {
      return 0;
    }
    return new BigNumber(spaceInGb).dividedBy(this.capacityInGb).multipliedBy(100).decimalPlaces(2).toString();
  }

  public convertCapacityInGbToDenominator(capacityInGb: number) {
    switch (this.selectedCapacityDenominator) {
      case 'TB': return new BigNumber(capacityInGb).dividedBy(1000).toNumber();
      default: return capacityInGb;
    }
  }

  get selectedCapacityDenominator(): string {
    return this._selectedCapacityDenominator;
  }

  set selectedCapacityDenominator(value: string) {
    let convertedValue = null;
    if (this._selectedCapacityDenominator !== value) {
      switch (value) {
        case 'TB':
          convertedValue = new BigNumber(this.capacityInGb).dividedBy(1000).toNumber();
          break;
        case 'GB':
          convertedValue = this.capacityInGb;
          break;
      }
    }
    this._selectedCapacityDenominator = value;
    if (convertedValue !== null) {
      this.capacity = convertedValue;
    }
  }

  private calculatePlotPlan(): PlotPlan {
    return this.plotPlanCalculator.calculateFor(new BigNumber(this.capacityInGb))
  }

  private get capacityInGb() {
    switch (this.selectedCapacityDenominator) {
      case 'TB': return new BigNumber(this.capacity).multipliedBy(1000).toNumber();
      default: return this.capacity;
    }
  }

  private initializeWebWorker() {
    if (typeof Worker === 'undefined') {
      return
    }
    this.worker = new Worker(new URL('./app.worker', import.meta.url))
    this.worker.onmessage = ({ data }) => {
      this.isCalculating = false
      this.plotPlan = data
    }
  }
}
