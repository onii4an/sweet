class MainBoyController < ApplicationController
  before_action :check_boy

  def index
    current_boy.update('waiting' => false)
  end

  private

  def check_boy
    redirect_to root_path unless current_boy
  end
end
