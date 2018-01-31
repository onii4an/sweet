class MainGirlController < ApplicationController
  before_action :check_girl

  def index; end

  private

  def check_girl
    redirect_to root_path unless current_girl
  end
end
