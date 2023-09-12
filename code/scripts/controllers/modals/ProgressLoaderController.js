const {FwController} = WebCardinal.controllers;

export default class ProgressLoaderController extends FwController {
  constructor(element, history, ...args) {
    super(element, history, ...args);
    const slider = this.element.querySelector("[name='slider']");

    let startProgressBar = () => {
      let progressPercent = 15;
      let progressPercentTimeout = 100;
      this.interval = setInterval(() => {
        slider.style.width = `${progressPercent}%`;
        if (progressPercent < 70) {
          progressPercent++;
        } else if (progressPercent < 90) {
          progressPercent++;
          progressPercentTimeout = 300;
        } else if (progressPercent >= 97) {
          clearInterval(this.interval)
        }
      }, progressPercentTimeout)
    };
    startProgressBar();
    this.model.onChange("currentStep", () => {
      slider.style.width = `100%`;
      if (this.model.currentStep > this.model.steps) {
        return
      }
      clearInterval(this.interval);
      startProgressBar();
      this.model.progressText = this.model.updateProgressInfo(this.model.currentStep, this.model.steps)
    })
  }
}
